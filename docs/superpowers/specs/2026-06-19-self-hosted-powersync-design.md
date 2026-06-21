# Self-hosted PowerSync — design

**Date:** 2026-06-19
**Status:** Approved (Approach A — docker-compose + MongoDB bucket store + Caddy)

## Problem

The mobile client today connects to a managed PowerSync Cloud instance
(`https://69a63aa63488e6ec9dcecd9f.powersync.journeyapps.com`, surfaced via
`EXPO_PUBLIC_POWERSYNC_ENDPOINT` and consumed in `powersync/Connector.ts:154`).
We want to move sync to a self-hosted PowerSync instance on a company-owned
remote server (fresh, SSH credentials available, otherwise empty) so we
control:

- Network locality with the source Postgres (avoids the egress hop to a
  managed region).
- Data residency.
- Cost / vendor coupling.
- The upgrade cadence.

The source database (Django backend's Postgres 16) lives on a separate server
on the same private network. The Django backend already has the full JWT
plumbing PowerSync requires: RS256 token minting
(`accounts/utils/powersync_utils.py:62`), a JWKS endpoint
(`accounts/views/jwks_views.py:15`, routed at
`accounts/urls.py:44` as `/api/powersync/jwks/`), and a `role` claim that
matches `sync-rules.yaml`. No backend code changes required — only config.

## Constraints

### Source Postgres

- Postgres 16 on a separate server, same private network.
- Admin access is owned by the company sysadmin, not the engineer driving
  this work; coordinate for any `postgresql.conf` edits.
- A test database on the same admin's control already has `wal_level = logical`,
  confirming the operator knows how to flip it. The actual target database's
  `wal_level` is **TBD — verify before go-live**.
- PowerSync needs: `wal_level = logical`, a dedicated DB role with
  `REPLICATION` privilege, a publication for the synced tables, a logical
  replication slot it owns, and network reachability on `5432/tcp` from
  the new PowerSync server.

### Auth

- All PowerSync JWTs are RS256, minted by Django, 15-minute lifetime.
- JWKS endpoint at `<django>/api/powersync/jwks/` already returns the
  current public key with a deterministic `kid` derived from the modulus
  (`accounts/utils/powersync_utils.py:48`).
- `aud` claim currently defaults to the managed PowerSync URL
  (`accounts/utils/powersync_utils.py:74`); must be updated to the new
  self-hosted URL on cut-over.
- `role` claim values (`Student`, `Teacher`, `Academic Director`,
  `Program Head`) must continue to match `sync-rules.yaml` exactly.

### Mobile client

- `EXPO_PUBLIC_POWERSYNC_ENDPOINT` is inlined into the JS bundle at
  build/start time (see `.env.example:6`), so changing it requires either
  a new app build or an EAS Update push.
- The mobile upload path goes directly to Django REST
  (`powersync/Connector.ts:183`), **not** through PowerSync. The self-hosted
  cut-over does not touch the upload path; in-flight CRUD ops are
  unaffected.
- The Rust sync client is pinned in `powersync/system.ts:126`
  (`SyncClientImplementation.RUST`). Self-hosted PowerSync must run a
  version that supports the Rust client (current versions do; pin to a
  known-good tag).

### Server (target host)

- OS / specs / Docker presence are unknown today; these are runtime
  discoveries (`cat /etc/os-release`, `nproc`, `free -m`, `df -h`,
  `docker --version`) and are captured as Step 1 of the implementation
  plan, not blockers for design.
- The DNS / TLS domain decision is owned by the sysadmin.

## Decision

Approach **A — docker-compose with MongoDB bucket store and Caddy as the
TLS reverse proxy.** This is PowerSync's official self-hosting path, has
the most upstream documentation, and lets us upgrade with
`docker compose pull && docker compose up -d`.

Approaches considered and rejected:

- **B — Postgres bucket store.** Avoids MongoDB, but Postgres-backed
  bucket storage is newer in PowerSync, has fewer published examples,
  and sharing the source Postgres for bucket state couples two failure
  domains.
- **C — bare-metal Node install with systemd.** Lighter abstraction, but
  PowerSync ships Docker images, not packages; upgrades become manual;
  reproducibility suffers.

## Architecture

```
                                ┌──── new server ────────────────────────────┐
                                │                                            │
   Mobile app ───── HTTPS ─────►│ Caddy :443 ─── HTTP :8080 ─► PowerSync svc │
   (Connector.ts                │  (TLS + LE)                   (Node, sync) │
    fetchCredentials)           │                                  │  ▲      │
                                │                                  ▼  │      │
                                │                              MongoDB :27017│
                                │                              (bucket store)│
                                │                                            │
                                └────────────────────────────────────────────┘
                                            │   ▲
                                            │   │ logical replication
                                            ▼   │
                            ┌─── existing Postgres 16 server ─────┐
                            │   wal_level=logical, publication,   │
                            │   replication slot owned by         │
                            │   PowerSync                         │
                            └─────────────────────────────────────┘

                            ┌──── Django backend ────┐
                            │ /api/powersync/jwks/   │◄── PowerSync fetches
                            │ /api/.../powersync-tok │    JWKS to verify
                            └────────────────────────┘    incoming JWTs
```

### Components (Compose services)

| Service | Image | Role | Volumes |
|---|---|---|---|
| `powersync` | `journeyapps/powersync-service` (pin to a known-good tag) | Reads source PG WAL → writes bucket state to Mongo → streams to clients over WebSocket; validates client JWTs via JWKS | `./config:/config:ro` |
| `mongo` | `mongo:7` | PowerSync's internal sync state — **not** app data | `mongo-data:/data/db` |
| `caddy` | `caddy:2` | TLS termination + reverse proxy on :443/:80; automatic Let's Encrypt issuance | `caddy-data:/data`, `caddy-config:/config`, `./Caddyfile:/etc/caddy/Caddyfile:ro` |

All three on the default Compose bridge network; only Caddy exposes
host ports.

### Data flow

1. **Downsync (server → mobile).** PowerSync subscribes to the source
   Postgres publication via a logical replication slot it owns,
   materializes rows into MongoDB-backed buckets per `sync-rules.yaml`,
   and streams matching buckets to each connected client over a
   WebSocket. Per-user bucket filtering uses the `role` claim in the JWT.
2. **Upsync (mobile → server).** The mobile `Connector.uploadData`
   PUT/PATCH/DELETEs directly against
   `${EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`. PowerSync is not in
   the upload path. Existing idempotency logic
   (`IdempotentLocalIdUpsertMixin` server-side, `op.id` carried in the
   URL as the local_id PK) is unchanged.

## Auth integration

### Server-side PowerSync config (`powersync.yaml`)

```yaml
client_auth:
  jwks_uri: https://api.<domain>/api/powersync/jwks/
  audience:
    - https://powersync.<domain>
  # supported_algorithms defaults to RS256, matches Django.
```

### Django-side change

One environment variable, no code:

```
POWERSYNC_AUDIENCE=https://powersync.<domain>
```

After Django restarts with the new env var, freshly-minted tokens carry
the new audience and the self-hosted instance accepts them. Existing
15-minute tokens minted with the old audience expire naturally; no
force-logout required.

### Key rotation story

Django's JWKS endpoint always serves the current public key. PowerSync
caches it briefly and re-fetches on cache miss or `kid` mismatch. To
rotate: deploy the new key on Django (JWKS publishes both old + new
during the overlap window), PowerSync picks up the new one
automatically. No PowerSync redeploy needed.

### Mobile-side change (cut-over)

One environment variable:

```
EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://powersync.<domain>
```

Because `EXPO_PUBLIC_*` vars are inlined at build time, this requires
a new build (full release or EAS Update).

## Networking & TLS

### Public surface

| Port | Service | Purpose |
|---|---|---|
| 443/tcp | Caddy | HTTPS, including WebSocket upgrades for the sync stream |
| 80/tcp | Caddy | HTTP-01 ACME challenge; 301 → 443 for everything else |
| 22/tcp | sshd | admin only, source-restricted to sysadmin IPs where possible |

PowerSync's :8080 and MongoDB's :27017 stay on the Compose internal
network and are never exposed to the host or the internet.

### DNS

Sysadmin creates an `A` record (working name `powersync.<domain>`) →
new server's public IP. On first request, Caddy auto-provisions a
Let's Encrypt cert via HTTP-01.

### Caddyfile

```caddyfile
powersync.<domain> {
    reverse_proxy powersync:8080
    encode gzip zstd
    log {
        output stdout
        format console
    }
}
```

Caddy handles WebSocket upgrades by default — no extra config.

### Outbound reachability the new server requires

- Source Postgres on `5432/tcp` (same private network).
- Django backend on `443/tcp` (JWKS fetch).
- `acme-v02.api.letsencrypt.org` on `443/tcp` (cert issuance).
- Docker Hub / GHCR on `443/tcp` (image pulls).

### Source PG firewall (sysadmin coordination)

Allow the new server's IP on `5432`. If `pg_hba.conf` is IP-locked, add
an entry along the lines of:

```
host  <appdb>  powersync_user  <new-server-ip>/32  scram-sha-256
```

Open question for sysadmin: is there a corporate firewall between the
two servers despite shared private network? Confirm before cut-over,
not a design blocker.

## Storage, backup, and the slot-WAL risk

### What state lives where

| Data | Where | Volatility | Recovery if lost |
|---|---|---|---|
| Source app data | external Postgres 16 | authoritative | sysadmin's backups |
| PowerSync bucket storage | MongoDB volume on new server | rebuildable | re-bootstrap from Postgres (hours, not data loss) |
| Logical replication slot state | inside source Postgres | critical | drop slot → forces re-bootstrap on new instance |
| Caddy TLS certs | `caddy-data` volume | re-issuable | LE re-issues on restart |
| `powersync.yaml`, `sync-rules.yaml`, `Caddyfile`, `compose.yaml` | git repo | source of truth | `git pull` |

### Backup posture (deliberately minimal)

1. **No MongoDB backup pipeline.** The bucket store is rebuildable from
   the source Postgres by definition. A re-bootstrap costs hours of
   catch-up replication once in a blue moon; running a backup pipeline
   costs daily complexity plus a new failure surface. Trade favors no
   backups. Reconsider when sync volume grows enough that re-bootstrap
   RTO becomes unacceptable.
2. **Single MongoDB node, no replica set.** PowerSync's Mongo usage is
   cache-shaped, not system-of-record. A replica set is three
   containers and quorum logic for negligible gain at our scale.
3. **YAMLs in git.** Free, non-negotiable.
4. **Caddy volumes mounted.** Free; spares LE rate-limit on rebuilds.

### The slot-WAL risk — the one Postgres-side gotcha

PowerSync owns a logical replication slot on the source Postgres. The
slot retains WAL until PowerSync consumes it. If self-hosted PowerSync
is offline long enough, the source Postgres's WAL grows until disk
fills — which is a real outage of the live Django app.

Mitigations:

- **`max_slot_wal_keep_size` on source PG** (e.g. `10GB`, scaled to the
  source PG's free disk headroom). When the slot's WAL backlog exceeds
  this, Postgres drops the slot. PowerSync notices on reconnect and
  re-bootstraps. Bad outcome (re-bootstrap) instead of catastrophic
  outcome (Django DB disk full).
- **Slot lag monitoring.** A 5-minute cron on source PG querying
  `pg_replication_slots`, alerting if
  `pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) > 2GB`.
  Catches the slot problem before the cap drops it.

## Migration / cut-over

Uploads go to Django REST, not PowerSync, so endpoint cut-over does
not risk in-flight CRUD ops — they keep targeting the same
`EXPO_PUBLIC_API_URL`.

### Sequence

1. **Stand up self-hosted, idle.** Point at source PG, load
   `sync-rules.yaml`. Managed instance still serves all real clients.
2. **Validate end-to-end with a test account.** Build a dev variant of
   the mobile app with `EXPO_PUBLIC_POWERSYNC_ENDPOINT` pointed at the
   new server, sign in as a test user, confirm downsync + uploads.
3. **Flip Django `POWERSYNC_AUDIENCE`**, restart Django. Order matters:
   audience must flip *before* mobile starts hitting self-hosted, or
   freshly-minted tokens carry the old audience and self-hosted
   rejects them.
4. **Ship mobile build with new endpoint** via EAS Update or store
   release.
5. **Grace period (~2 weeks)** with both instances live. Watch slot
   lag, error rates, sync-event metrics in Sync Center.
6. **Decommission managed instance** after the grace period.

### Client behavior on first connect to new endpoint

PowerSync detects an instance ID change and triggers a **local
re-bootstrap** — the client drops its synced rows and re-downloads
from the new instance. Effects:

- One-time "syncing…" period on each user's first launch after the new
  build lands.
- Any uploaded-but-not-yet-acked CRUD ops survive — they live in
  `ps_crud_meta_local` and the PowerSync CRUD queue, both independent
  of bucket state.
- Local-only tables (`attachments_local`, `sync_events_local`,
  `ps_crud_meta_local` per `powersync/system.ts:56`) are unaffected.

Worth telling users-in-the-loop: "first app launch after this update
may take a minute to sync, this is expected."

### Rollback plan

1. Revert Django `POWERSYNC_AUDIENCE` env to the managed URL, restart
   Django.
2. EAS Update push reverting `EXPO_PUBLIC_POWERSYNC_ENDPOINT`.
3. Clients re-bootstrap one more time against managed.

Cost: another forced re-bootstrap on every user. Annoying, not
destructive.

## Monitoring & ops

### Healthchecks (Compose)

```yaml
powersync:
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/probes/liveness"]
    interval: 30s
    timeout: 5s
    retries: 3
  restart: unless-stopped

mongo:
  healthcheck:
    test: ["CMD", "mongosh", "--quiet", "--eval", "db.runCommand({ping:1}).ok"]
    interval: 30s
    retries: 3
  restart: unless-stopped

caddy:
  restart: unless-stopped
```

`restart: unless-stopped` recovers from transient crashes without
paging anyone.

### Logs

- Docker JSON log driver, capped per container:
  `max-size: 50m`, `max-file: 5`. Prevents disk fill from runaway logs.
- `docker compose logs -f powersync` for live tailing during ops.
- No centralized log shipping on day one. Add it when the team feels
  the pain.

### Metrics (deliberately minimal)

- External uptime monitor pointed at
  `https://powersync.<domain>/probes/liveness`. Cheapest possible
  "is it up" signal.
- Slot lag cron on source PG (Section on storage).
- No Prometheus/Grafana stack on day one.

### Upgrades

```bash
cd /opt/powersync                # or wherever the compose lives
git pull                          # if YAMLs are in git
docker compose pull               # pull pinned image tags
docker compose up -d              # recreate changed containers
docker compose logs -f powersync  # watch it come up clean
```

Pin image tags (e.g. `journeyapps/powersync-service:1.x.y`, not
`:latest`). Bumping versions becomes a git commit.

### On-call runbook (one-pager, lives next to the compose)

- **"Mobile users can't sync"** → `curl https://powersync.<domain>/probes/liveness`,
  `docker compose logs powersync --tail=200`, check source-PG slot lag.
- **"Source PG disk filling"** → check `pg_replication_slots` lag; if
  PowerSync is down or stuck, the slot is the cause. Either bring
  PowerSync back or drop the slot (forces re-bootstrap; recoverable).
- **"JWKS validation failing post-deploy"** → Django
  `POWERSYNC_AUDIENCE` mismatch with PowerSync `audience` config is the
  usual culprit.

### Explicit non-goals for v1

- HA / multi-node PowerSync.
- MongoDB replica set.
- Centralized log aggregation.
- Auto-deploys / CI for the compose host (manual `git pull + docker
  compose up -d` is faster than the CI setup until the cadence
  justifies it).

## Open items resolved before go-live

These are not design unknowns — they are scheduled steps in the
implementation plan:

- Confirm `wal_level = logical` on the actual target Postgres (the
  earlier check was against a test database).
- Confirm `max_replication_slots` and `max_wal_senders` on source PG
  have non-zero headroom (defaults usually fine).
- Sysadmin chooses + provisions the DNS name; engineer plugs it into
  `Caddyfile`, `powersync.yaml` audience list, and Django
  `POWERSYNC_AUDIENCE`.
- Server discovery (OS, vCPU/RAM/disk, Docker presence) — Step 1 of
  the implementation plan.
- Confirm no corporate firewall blocks `5432/tcp` from the new server
  to source PG despite shared private network.
- Decide whether sync-rules YAMLs live in `client-mobile/`, a sibling
  `classedge-powersync-infra` repo, or alongside the Django repo.

## Out of scope

- Sync-rules content changes; we lift the existing YAMLs from the
  managed instance verbatim.
- Server hardening beyond Caddy TLS + restart policies + SSH-IP
  restriction (sysadmin owns the broader server hardening posture).
- Cost/savings analysis for cancelling the managed instance.
- Multi-region or geo-replicated PowerSync.
