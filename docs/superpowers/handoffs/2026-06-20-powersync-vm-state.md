# Self-hosted PowerSync — deployment guide & VM state

> **Status as of 2026-06-20:** Stack running on the VM at `~/powersync` (user `jeffy@powersync-server`). Two services healthy: `powersync` and `mongo`. Replicating against the **real source Postgres** at `172.16.0.56` (private network, the `newcollegelms` DB), initial bootstrap complete, tailing live WAL. Auth fully wired: JWKS endpoint verified live, audience `powersync-classedge` configured. End-to-end mobile sign-in tested via a `cloudflared` quick tunnel — real data populates. **Only blocker left:** sysadmin assigns a permanent public hostname so we can retire the cloudflared tunnel.

> This doc doubles as a reusable deployment guide — every choice/gotcha that bit us during this stand-up is captured below so future setups don't re-hit them.

**Original plan this diverges from:** [docs/superpowers/plans/2026-06-19-self-hosted-powersync.md](../plans/2026-06-19-self-hosted-powersync.md)

---

## 1. Final architecture

Two containers on the VM:

| Service | Image | Role |
|---|---|---|
| `powersync` | `journeyapps/powersync-service:1.22.0` | Sync API on `:8080`; pulls from source PG via logical replication, writes buckets to Mongo |
| `mongo` | `mongo:7` (replica set `rs0`, single member) | Bucket storage. MUST be a replica set — PowerSync writes use transactions, which standalone mongo rejects |

Plus one external dependency:

| | Where | Role |
|---|---|---|
| Source Postgres | `172.16.0.56:5432` (private network) | The application database; PowerSync subscribes to its WAL via a publication |

File layout on the VM:

```
~/powersync/
├── compose.yaml          # Two-service stack: powersync + mongo
├── .env                  # PS_PG_* connection vars (literal password, no URL encoding)
└── config/
    ├── powersync.yaml    # service config (replication, storage, sync_rules, client_auth)
    └── sync-rules.yaml   # copy of the managed-instance rules (~223 lines)
```

Port `:8080` is published on the VM's private IP only. The sysadmin will eventually put a public reverse proxy in front of it to handle TLS at `:443`.

---

## 2. The complete `compose.yaml`

```yaml
name: powersync

services:
  powersync:
    image: journeyapps/powersync-service:1.22.0
    command: ["start", "-r", "unified"]
    restart: unless-stopped
    depends_on:
      mongo:
        condition: service_healthy
    ports:
      - "8080:8080"
    env_file:
      - .env
    environment:
      - POWERSYNC_CONFIG_PATH=/config/powersync.yaml
      - PS_MONGO_URI=mongodb://mongo:27017/powersync?replicaSet=rs0
    volumes:
      - ./config:/config:ro
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8080/probes/liveness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

  mongo:
    image: mongo:7
    restart: unless-stopped
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all"]
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "try { rs.status().ok } catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]}).ok }"]
      interval: 5s
      timeout: 30s
      retries: 30
      start_period: 5s

volumes:
  mongo-data:
```

Three things that look optional but aren't:

1. **`env_file: - .env`** on the powersync service. Compose's `.env` is loaded for *interpolation in compose.yaml* — vars there don't automatically appear *inside* the container. `env_file:` makes the contents of `.env` available as container env vars, which `!env` references in `powersync.yaml` then pick up.
2. **`?replicaSet=rs0`** in the mongo URI. PowerSync's MongoDB driver also needs to talk replica-set protocol, not standalone.
3. **`node -e fetch(...)`** in the healthcheck. The PowerSync image **doesn't ship `wget`** (or `curl`), so the documentation-default `wget` healthcheck fails silently and the container reports `unhealthy` forever even when the service is fine. Node is guaranteed to be there since PowerSync runs on it.

---

## 3. The complete `config/powersync.yaml`

```yaml
replication:
  connections:
    - type: postgresql
      hostname: !env PS_PG_HOSTNAME
      port: !env PS_PG_PORT
      database: !env PS_PG_DATABASE
      username: !env PS_PG_USERNAME
      password: !env PS_PG_PASSWORD
      sslmode: disable

storage:
  type: mongodb
  uri: !env PS_MONGO_URI

port: 8080

sync_rules:
  path: /config/sync-rules.yaml

client_auth:
  jwks_uri: https://classedge.hccci.edu.ph/api/powersync/jwks/
  audience:
    - powersync-classedge
```

Why discrete fields (`hostname:`, `port:`, etc.) instead of a single `uri:`:

We initially used `uri: !env PS_DATA_SOURCE_URI`. PowerSync's `pgwire` driver does **not** URL-decode special characters in the password the way `libpq` does. Our password contains `]`, `{`, `@`, `<`, `\` — all URL-encoded in the URI. `psql` connected fine (because libpq decodes). PowerSync got `password authentication failed for user "newcollegelms"` (because pgwire sent the still-URL-encoded literal). Switching to discrete fields with a literal-quoted password bypasses URL encoding entirely.

Why `sslmode: disable` lives in this YAML and not the URI: PowerSync's own config schema has its own `sslmode` field that defaults to `verify-full`, which **overrides** any `?sslmode=disable` in the URI. If you don't set it explicitly here, you'll get `Replication error postgres does not support ssl` against a non-TLS PG.

---

## 4. The complete `.env`

```
PS_PG_HOSTNAME=172.16.0.56
PS_PG_PORT=5432
PS_PG_DATABASE=newcollegelms
PS_PG_USERNAME=newcollegelms
PS_PG_PASSWORD='o]1x{@4<\5R2'
```

Single-quote the password so the shell/Compose preserves backslashes and special chars as literals — no escaping needed. Do **not** URL-encode anything in this file; this is the raw password going to discrete config fields.

---

## 5. Setting up the source Postgres (Group A)

Run on the source PG server. Items marked ⚠ require a PG **restart**; everything else is a `pg_reload_conf()` away.

### 5.1 `postgresql.conf`

```
wal_level = logical                ⚠ restart required
max_replication_slots = 10
max_wal_senders = 10
max_slot_wal_keep_size = 10GB      # safety cap so a stuck slot can't fill the disk
```

Verify:

```sql
SHOW wal_level;              -- expect: logical
SHOW max_replication_slots;  -- expect: ≥ 4
SHOW max_wal_senders;        -- expect: ≥ 4
SHOW max_slot_wal_keep_size; -- non-zero (any positive)
```

### 5.2 Replication role

You can either reuse the app role (what we did — `newcollegelms`) or create a dedicated `powersync_role`. The privileges needed:

```sql
ALTER ROLE newcollegelms WITH REPLICATION;
-- (If creating dedicated:)
-- CREATE ROLE powersync_role WITH REPLICATION LOGIN PASSWORD '<strong>';
-- GRANT CONNECT ON DATABASE <appdb> TO powersync_role;
-- GRANT USAGE ON SCHEMA public TO powersync_role;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role;
```

Verify:

```sql
SELECT rolname, rolreplication FROM pg_roles WHERE rolname = 'newcollegelms';
-- want rolreplication = t
```

### 5.3 Publication

```sql
\c <appdb>                                          -- IMPORTANT: must be in the right DB
CREATE PUBLICATION powersync FOR ALL TABLES;
```

Verify:

```sql
SELECT pubname, puballtables FROM pg_publication WHERE pubname = 'powersync';
-- want one row, puballtables = t
```

**Two traps to avoid here:**

1. **Publications are per-database.** Running `CREATE PUBLICATION powersync ...` in the `postgres` administrative DB instead of the app DB creates the publication in the wrong place; PowerSync (which connects to the app DB) won't see it. The DB admin must `\c <appdb>` first.
2. **`FOR ALL TABLES` requires superuser.** Regular DB owners (like `newcollegelms`) can't create one of those. If only superuser can grant it, hand the one-liner to the DB admin. If you want a non-superuser-creatable publication, you can list the tables explicitly — but maintenance cost is real.

### 5.4 `pg_hba.conf`

Allow the VM's private IP. Note the special `replication` row type:

```
host  <appdb>     newcollegelms  <VM_PRIVATE_IP>/32  scram-sha-256
host  replication newcollegelms  <VM_PRIVATE_IP>/32  scram-sha-256
```

Both lines matter. PowerSync makes a regular connection AND a replication-protocol connection; they're governed by separate `pg_hba` rules. If only one is allowlisted you'll get `password authentication failed` (or `no pg_hba.conf entry for replication connection`) for the missing one. Reload with `SELECT pg_reload_conf();`.

### 5.5 End-to-end verification from the VM

```bash
sudo apt-get install -y postgresql-client
DB="postgresql://<user>:<password>@<host>:<port>/<db>?sslmode=disable"

# Network reachability
getent hosts <db-host>
nc -zv <db-host> 5432

# Auth + role + publication + WAL config in one shot
psql "$DB" -c "SELECT 1 AS ok;"
psql "$DB" -c "SELECT rolname, rolreplication FROM pg_roles WHERE rolname = current_user;"
psql "$DB" -c "SELECT pubname, puballtables FROM pg_publication WHERE pubname = 'powersync';"
psql "$DB" -c "SELECT name, setting FROM pg_settings WHERE name IN ('wal_level','max_replication_slots','max_wal_senders','max_slot_wal_keep_size');"
psql "$DB" -c "SELECT slot_name, active FROM pg_replication_slots WHERE slot_name LIKE 'powersync%';"
```

All five must look right before you flip PowerSync over. If any are wrong, the PowerSync logs will eventually tell you — but pre-flight is cheaper than debug.

---

## 6. Auth integration

```yaml
client_auth:
  jwks_uri: https://classedge.hccci.edu.ph/api/powersync/jwks/
  audience:
    - powersync-classedge
```

How it works:

1. Mobile client logs in → Django at `/api/powersync/token/` mints a short-lived JWT (RS256).
2. JWT carries an `aud` claim equal to `powersync-classedge` (Django's `POWERSYNC_AUDIENCE` env var).
3. Mobile sends JWT to PowerSync.
4. PowerSync fetches Django's public keys (one-time, then cached) from the `jwks_uri`.
5. PowerSync verifies signature, `exp`, and that `aud` is in its `audience:` list. Pass → sync; fail → 401.

Sanity-test the JWKS endpoint:

```bash
curl -s https://classedge.hccci.edu.ph/api/powersync/jwks/ | head -c 300
# Expect JSON: {"keys":[{"kty":"RSA","use":"sig","alg":"RS256","kid":"…","n":"…"}]}
```

**The audience is a stable identifier, not a URL.** Because `powersync-classedge` is a label rather than the server's URL, it does **not** change when the public hostname is assigned. No dual-audience cut-over dance — Django keeps minting the same `aud`, PowerSync keeps validating against the same string, regardless of how the URL changes.

---

## 7. Port + TLS architecture (private-network deployment)

The VM lives on a private network with no public IP. The sysadmin's gateway handles the public-internet side and TLS.

```
mobile client (HTTPS)         sysadmin's gateway                your VM
─────────────────► :443  ───────────────────────────►  172.16.x.x:8080
                          (terminates TLS, forwards plain HTTP)        (PowerSync)
```

| Box | Listens on | TLS? |
|---|---|---|
| Mobile | hits `:443` on the public hostname | yes (mobile refuses plain HTTP) |
| Sysadmin gateway | `:443` from internet | terminates TLS here |
| VM | `:8080` from private network | no — plain HTTP, inside the trusted network |
| PowerSync (in container) | `:8080` | no |

What you give the sysadmin:

- VM's private IP (`172.16.x.x`)
- Port `8080`
- "Plain HTTP — please terminate TLS upstream"

What you get back:

- A public hostname like `powersync.classedge.hccci.edu.ph` that mobile clients hit via HTTPS

If you ever stand this up in a setup *without* a sysadmin gateway, add a `caddy` service to `compose.yaml` to terminate TLS on the VM itself. Caddy auto-issues Let's Encrypt certs given a hostname and reverse-proxies to PowerSync on `8080`.

---

## 8. Dev / smoke-testing via `cloudflared`

For end-to-end mobile testing before the sysadmin assigns the permanent hostname, use a Cloudflare Quick Tunnel.

### Install

```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### Run

```bash
cloudflared tunnel --url http://localhost:8080
```

Prints a `https://<random-words>.trycloudflare.com` URL. That URL tunnels to PowerSync on the VM. From your laptop:

```bash
curl -s https://<random>.trycloudflare.com/probes/liveness && echo
# Expect: {"ready":true,"started":true,"touched_at":"..."}
```

### Point the mobile build at it

In local `client-mobile/.env`:

```
EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://<random>.trycloudflare.com
```

Restart Metro, sign in as a real test user, watch real data populate.

### What success looks like

When you sign in on the dev mobile build pointed at the tunnel URL, watch three places:

**Mobile app UI:**
- Splash → home loads without a `Failed to sync` toast or error banner
- Data screens populate with real data — classroom lists, schedule items, announcements, etc. (NOT the empty state from the throwaway PG)
- Sync indicator (if visible) goes from "syncing" to settled within a few seconds of first sign-in
- Pull-to-refresh works; CRUD actions (e.g. mark notification read, save a draft) complete without rolling back

**Metro logs (mobile dev console):**
- `[Connector]` lines showing successful PUT/PATCH against the Django backend (uploads still go through Django, not through PowerSync)
- No `401` storm. A single `401` followed by a successful retry is normal (first token refresh). A sustained 401 loop means audience or JWKS is wrong on the PowerSync side.
- No `WebSocket closed` / `connection error` reconnect spam

**VM PowerSync logs (`docker compose logs powersync -f`):**
- New `[powersync_…] Locked replication stream for processing` lines as you interact with the app
- `Replicating op N …` keeps incrementing on every CRUD action in the app
- No `audience mismatch` / `invalid aud` / `failed to fetch jwks` errors
- A clean WebSocket connect line on first sign-in (no immediate disconnect)

**VM source DB slot (`psql` from the VM):**

```bash
psql "$DB" -c "SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag FROM pg_replication_slots WHERE slot_name LIKE 'powersync%';"
```

- One row, `active=t`, `lag` stays small (< 1 MB) while the app is idle
- Lag briefly grows after a burst of CRUD, then catches up within a second or two

If all four look right, the deployment is sound and you can hand the VM details to the sysadmin for permanent hosting.

### Caveats

- **URL regenerates every cloudflared restart.** Don't bake into anything durable.
- **WebSockets work transparently** — cloudflared proxies them by default. We verified this with PowerSync's streaming sync; no special config needed.
- This is dev-only. Production uses the sysadmin's permanent hostname.

---

## 9. Gotchas (the full list)

In rough order of how much time they cost us:

1. **pgwire doesn't URL-decode passwords.** Special chars in the password (`]`, `{`, `@`, `<`, `\`, etc.) work in `psql` (libpq decodes) but not in PowerSync (pgwire doesn't). Use discrete `hostname:`/`port:`/.../`password:` fields with `!env` references to a `.env` value containing the literal password, single-quoted.
2. **Compose's `.env` is for interpolation, not container env.** Variables defined in `.env` are substituted into `${VAR}` references inside `compose.yaml` but are NOT automatically passed into the container's environment. Use `env_file: [.env]` on the service, OR list each var explicitly in `environment:`.
3. **Publications are per-database.** `CREATE PUBLICATION powersync …` run in the wrong DB (e.g. `postgres` admin DB) silently puts it where PowerSync can't see it. Always `\c <appdb>` first.
4. **Two `pg_hba.conf` lines needed.** Regular `host <appdb>` AND `host replication`. Replication protocol is a separate connection type. Missing the second → `password authentication failed` on PowerSync side.
5. **MongoDB transactions require a replica set.** Standalone `mongod` rejects PowerSync writes with `Transaction numbers are only allowed on a replica set member or mongos`. Run with `--replSet rs0`, initiate via an idempotent `rs.initiate()` in the healthcheck, and use `?replicaSet=rs0` on the PowerSync→Mongo URI.
6. **PowerSync's `sslmode` overrides the URI's.** Set `sslmode: disable` in `powersync.yaml`'s connection block; the URI query string is ignored. Default is `verify-full`.
7. **PowerSync image has no `wget` or `curl`.** Don't use either in the healthcheck — they'll fail silently and report `unhealthy` permanently. Use Node: `node -e "fetch(...).then(...)"`.
8. **`publication_name:` / `slot_name:` schema fields aren't picked up in v1.22.0.** Or they're renamed. Don't try to override; use PowerSync's defaults (publication = `powersync`, slot auto-named like `powersync_2_b050`) and align the source DB to match.
9. **Long heredocs/`printf` lines get mangled by the SSH terminal.** Auto-indent on multi-line paste; wrap on very long lines. Use `nano` for multi-line files, brace `{ echo …; echo …; }` blocks, or `sed -i` for targeted single-line fixes. `printf '...'` on one long line is unreliable.
10. **`docker compose down` doesn't remove containers from services you've deleted from `compose.yaml`.** They become orphans. Use `docker compose down --remove-orphans`, then remove the volume if needed.
11. **`FOR ALL TABLES` publication needs superuser.** Owner-level roles can only publish specific tables. If you want auto-include of future tables, the DB admin has to be the one to run the `CREATE PUBLICATION`.

---

## 10. Operational quick reference

```bash
cd ~/powersync

# Status
docker compose ps
docker compose logs powersync --tail=50
docker compose logs powersync -f

# Lifecycle
docker compose restart powersync
docker compose down                    # volumes preserved
docker compose up -d

# Health
curl -s http://localhost:8080/probes/liveness && echo
curl -s https://classedge.hccci.edu.ph/api/powersync/jwks/ | head -c 200

# Source DB (set DB shell var first)
DB="postgresql://<user>:<password>@172.16.0.56:5432/newcollegelms?sslmode=disable"
psql "$DB" -c "SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag FROM pg_replication_slots WHERE slot_name LIKE 'powersync%';"
# Want: one row, active=t, lag small while idle (< 1 MB typical)

# Inspect container env (debug PS_PG_* visibility)
docker compose exec powersync printenv | grep -E '^PS_PG_'
```

### Reboot resilience (verified)

VM `sudo reboot` brings both containers back to healthy on its own via `restart: unless-stopped`. Mongo's healthcheck idempotently re-attaches to the existing replica set; PowerSync re-acquires the slot and resumes from its last LSN. Liveness probe returns 200 within ~30s of boot.

---

## 11. Next steps

✓ JWKS endpoint live (verified)
✓ Audience configured
✓ Source DB connected (real prod-equivalent DB on private network)
✓ Initial replication complete; tailing live WAL
✓ End-to-end mobile sign-in tested via cloudflared tunnel

Only blocker remaining:

1. **Sysadmin — public hostname.** Pick a hostname (e.g. `powersync.classedge.hccci.edu.ph`), point it at the gateway, route gateway-side `:443` → VM private IP `:8080`. When ready, mobile build flips `EXPO_PUBLIC_POWERSYNC_ENDPOINT` to that hostname via EAS env vars and ships an EAS Update.

Then:

2. **Mobile cut-over.** Because `aud` is a stable identifier (not a URL), no dual-audience window is needed. The same token validates against either the managed or self-hosted server. Just flip the endpoint and ship.
3. **Decommission managed PowerSync.** Once managed-instance traffic falls to zero, pause it in the PowerSync dashboard (keep dormant for one billing cycle, then delete).

---

## 12. Reusing this for other deployments

If you're standing up another self-hosted PowerSync VM (different env, different customer), the script is essentially:

### Prereqs on a fresh Ubuntu VM

```bash
# Install Docker + Compose v2 from Docker's official one-liner
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
sudo sh /tmp/get-docker.sh

# Add your user to the docker group so you don't need sudo
sudo usermod -aG docker $USER

# Activate the new group membership in the current shell
# (or log out + log back in over SSH)
newgrp docker

# Verify
docker run --rm hello-world
docker compose version
```

If `groups` doesn't show `docker` after `newgrp`, log out and back in — the group only takes effect in a fresh login session.

### Then the actual deployment

1. `mkdir -p ~/powersync/config && cd ~/powersync`
2. Drop in the three files from sections 2, 3, 4 of this doc (adjust DB connection vars and JWKS/audience for that deployment)
3. Drop your `sync-rules.yaml` into `config/`
4. Make sure the source PG is prepped per section 5 (DB admin's responsibility)
5. `docker compose pull && docker compose up -d`
6. Tail logs until you see `Replicating op …`:
   ```bash
   docker compose logs powersync -f
   ```
7. Smoke-test via `cloudflared tunnel --url http://localhost:8080`, point a dev mobile build at it (section 8)
8. Hand the VM's private IP + port `8080` to the sysadmin for public hostname + TLS

Total time on a fresh VM with prereqs in place: ~20 minutes. Add 1–4 hours if you hit one of the gotchas in section 9.
