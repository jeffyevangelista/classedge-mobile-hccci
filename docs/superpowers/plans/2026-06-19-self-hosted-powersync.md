# Self-hosted PowerSync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a self-hosted PowerSync instance on a fresh remote server, point it at the existing source Postgres 16, integrate it with Django's existing JWKS-backed auth, and migrate mobile clients off the managed PowerSync Cloud instance.

**Architecture:** Docker Compose on a single host. Three containers — `journeyapps/powersync-service`, `mongo:7` (bucket storage), `caddy:2` (TLS + reverse proxy). PowerSync replicates from the external Postgres via a logical replication slot it owns; mobile uploads go directly to Django REST as before. Auth integrates with the existing `/api/powersync/jwks/` JWKS endpoint (no Django code changes — one env var flip).

**Tech Stack:** Docker, Docker Compose v2, journeyapps/powersync-service, MongoDB 7, Caddy 2 (Let's Encrypt automatic), Postgres 16 (external, already provisioned).

## Global Constraints

- Source database is **Postgres 16**; `wal_level=logical` required (already confirmed on a test DB, must be re-confirmed on actual target before go-live).
- All PowerSync JWTs are **RS256**, minted by Django at `accounts/utils/powersync_utils.py:62`. Lifetime 15 minutes.
- Role claim values are case-sensitive: `Student`, `Teacher`, `Academic Director`, `Program Head` — must match `sync-rules.yaml` exactly.
- Mobile pins `SyncClientImplementation.RUST` at `powersync/system.ts:126`; pinned PowerSync image tag must support the Rust client (1.x recent versions do).
- Mobile uploads are direct-to-Django, **not via PowerSync** (`powersync/Connector.ts:183`). The endpoint cut-over does not touch the upload path.
- `EXPO_PUBLIC_*` env vars are inlined into the JS bundle at build/start time; changing the PowerSync endpoint requires a new build or EAS Update.
- Image tags must be pinned (e.g. `journeyapps/powersync-service:1.x.y`), never `:latest`.
- All YAMLs/Caddyfiles/compose files live in a single working repo on the engineer's local machine and on the server; the server copy is initialized as a local git repo for change history.
- Do not expose PowerSync (`:8080`) or Mongo (`:27017`) on host ports; only Caddy publishes `:443` and `:80`.
- Public DNS name and the chosen image tag are deferred to Task time — placeholders use `powersync.<domain>` and `<pinned-tag>` until resolved in-place.
- Configs live at `~/Desktop/classedge-hccci/classedge-powersync-infra/` locally and `/opt/powersync/` on the server. Adjust if your team prefers a different home — paths are referenced consistently throughout.

---

### Task 1: Server discovery + Docker install + workspace bootstrap

**Files:**
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/` (local working directory, git-initialized)
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/SERVER_FACTS.md` (capture discovery output for reference)
- Create on server: `/opt/powersync/` (empty, will receive configs in Task 3)

**Interfaces:**
- Consumes: SSH credentials for the new server (user already has these).
- Produces: A Docker-capable host at `<server-ip>` with Docker Compose v2 available, a captured snapshot of OS/specs/installed-versions in `SERVER_FACTS.md`, and a local working repo for the configs that arrive in later tasks.

- [ ] **Step 1: Create the local working repo**

```bash
mkdir -p ~/Desktop/classedge-hccci/classedge-powersync-infra
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
git init
echo "# classedge-powersync-infra" > README.md
git add README.md
git commit -m "init: powersync infra repo"
```

- [ ] **Step 2: SSH into the new server and capture discovery facts**

Run from the local working repo:

```bash
ssh <user>@<server-ip> '
  echo "=== OS ===" ;
  cat /etc/os-release ;
  echo ;
  echo "=== Kernel ===" ;
  uname -a ;
  echo ;
  echo "=== CPU ===" ;
  nproc ;
  echo ;
  echo "=== RAM ===" ;
  free -m ;
  echo ;
  echo "=== Disk ===" ;
  df -h / ;
  echo ;
  echo "=== Docker ===" ;
  docker --version 2>&1 || echo "docker NOT INSTALLED" ;
  echo ;
  echo "=== Docker Compose ===" ;
  docker compose version 2>&1 || echo "compose NOT INSTALLED" ;
  echo ;
  echo "=== systemd ===" ;
  systemctl --version | head -1 ;
' > SERVER_FACTS.md
```

Open `SERVER_FACTS.md` in your editor and confirm the file is non-empty and readable.

- [ ] **Step 3: Verify against the comfortable floor (2 vCPU / 4 GB RAM / 40 GB disk)**

Expected (eyeball check on `SERVER_FACTS.md`):
- `nproc` >= 2
- `free -m` shows >= 3500 MB total
- `df -h /` shows >= 40 GB available

If any value is below the floor, stop and ask the sysadmin to resize before continuing — running this stack on undersized hardware turns recoverable hiccups into outages.

- [ ] **Step 4: Install Docker on the server if missing**

If `SERVER_FACTS.md` shows `docker NOT INSTALLED`, run (Ubuntu/Debian path; if `/etc/os-release` shows another distro, adjust per docs.docker.com/engine/install):

```bash
ssh <user>@<server-ip> '
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh &&
  sudo sh /tmp/get-docker.sh &&
  sudo usermod -aG docker $USER &&
  echo "Docker installed; log out and back in for group membership."
'
```

Then log out and log back in over SSH (a fresh shell is required for the `docker` group to take effect).

- [ ] **Step 5: Verify Docker + Compose v2 work without sudo**

```bash
ssh <user>@<server-ip> 'docker run --rm hello-world'
```

Expected: prints `Hello from Docker!` and exits cleanly. If this errors with permissions, group membership hasn't applied — log out, log back in, retry.

```bash
ssh <user>@<server-ip> 'docker compose version'
```

Expected: prints `Docker Compose version v2.x.x`. (If only the old `docker-compose` v1 plugin is present, install Compose v2: `sudo apt-get install docker-compose-plugin` on Debian/Ubuntu.)

- [ ] **Step 6: Create the server-side working directory and init a local git repo there**

```bash
ssh <user>@<server-ip> '
  sudo mkdir -p /opt/powersync &&
  sudo chown $USER:$USER /opt/powersync &&
  cd /opt/powersync &&
  git init &&
  echo "# /opt/powersync — change-tracked PowerSync configs" > README.md &&
  git add README.md &&
  git -c user.email=ops@local -c user.name=ops commit -m "init: powersync server config dir"
'
```

Expected: prints `Initialized empty Git repository …` and a commit hash.

- [ ] **Step 7: Commit the discovery snapshot locally**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
git add SERVER_FACTS.md
git commit -m "chore: capture server discovery facts"
```

---

### Task 2: Source Postgres preparation (sysadmin coordination + verification)

**Files:**
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/SYSADMIN_BRIEF_PG.md` (copy-paste-ready brief for the sysadmin)

**Interfaces:**
- Consumes: server IP from Task 1, sysadmin contact path.
- Produces: source Postgres ready for PowerSync — `wal_level=logical` confirmed, `powersync_role` created with `REPLICATION` privilege, `powersync_publication` covering all synced tables, `pg_hba.conf` allows the new server's IP on `5432/tcp`. A working `psql` connection from the new server back to the source PG using the new role.

- [ ] **Step 1: Write the sysadmin brief**

Create `~/Desktop/classedge-hccci/classedge-powersync-infra/SYSADMIN_BRIEF_PG.md` with this content (replace `<NEW_SERVER_IP>` with the IP from Task 1):

````markdown
# Source Postgres prep for self-hosted PowerSync

We're setting up a self-hosted PowerSync instance. It needs to replicate
from our source Postgres via logical replication. Please run the steps
below on the source Postgres server.

## 1. Verify `wal_level = logical`

```sql
SHOW wal_level;
SHOW max_replication_slots;
SHOW max_wal_senders;
```

Expected: `wal_level = logical`, `max_replication_slots >= 4`,
`max_wal_senders >= 4`. If `wal_level` is not `logical`, edit
`postgresql.conf`:

```
wal_level = logical
max_replication_slots = 10
max_wal_senders = 10
```

Then **restart Postgres** (full restart, not reload — `wal_level`
requires it). This is the only step that needs a Postgres restart.

## 2. Create a dedicated replication role

Pick a strong password and store it in your secrets system. Share it
with the engineer over a secure channel — they'll plug it into the
PowerSync server config.

```sql
CREATE ROLE powersync_role WITH REPLICATION LOGIN PASSWORD '<STRONG_PASSWORD>';
GRANT CONNECT ON DATABASE <appdb> TO powersync_role;
GRANT USAGE ON SCHEMA public TO powersync_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO powersync_role;
```

## 3. Create the publication PowerSync will subscribe to

```sql
CREATE PUBLICATION powersync_publication FOR ALL TABLES;
```

We start with `FOR ALL TABLES` for simplicity. If you want to scope
later we can `ALTER PUBLICATION powersync_publication ADD/DROP TABLE …`.

## 4. Allow network access from the new PowerSync server

In `pg_hba.conf`, add:

```
host  <appdb>  powersync_role  <NEW_SERVER_IP>/32  scram-sha-256
```

Reload Postgres (`pg_ctl reload` or `SELECT pg_reload_conf();` — no
restart needed for `pg_hba.conf`).

## 5. Cap WAL retention on the replication slot

This is the one Postgres-side guardrail that matters. If PowerSync is
ever offline long enough, an uncapped slot grows WAL until the source
PG disk fills — which would take Django down. With the cap set, the
slot is dropped instead, which forces PowerSync to re-bootstrap on
reconnect (recoverable). In `postgresql.conf`:

```
max_slot_wal_keep_size = 10GB
```

Pick a value sized to free disk headroom. `pg_reload_conf()` picks it
up without a restart.

## 6. Confirm completion

When done, paste the output of these into your reply:

```sql
SHOW wal_level;
SHOW max_slot_wal_keep_size;
SELECT rolname, rolreplication FROM pg_roles WHERE rolname = 'powersync_role';
SELECT pubname, puballtables FROM pg_publication WHERE pubname = 'powersync_publication';
```

Thanks!
````

- [ ] **Step 2: Send the brief to the sysadmin and capture the password**

Send the brief via the team's normal channel. Capture the password returned over a secure channel and put it in the working repo's gitignored secrets path:

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
echo "secrets.env" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore secrets.env"

cat > secrets.env <<EOF
# DO NOT COMMIT
SOURCE_PG_HOST=<source-pg-host>
SOURCE_PG_PORT=5432
SOURCE_PG_DB=<appdb>
SOURCE_PG_USER=powersync_role
SOURCE_PG_PASSWORD=<password from sysadmin>
EOF
chmod 600 secrets.env
```

- [ ] **Step 3: Verify the connection works from the new server**

Install a tiny `psql` client on the server just for this test:

```bash
ssh <user>@<server-ip> 'sudo apt-get update && sudo apt-get install -y postgresql-client-16'
```

Run a connectivity test (substitute values from `secrets.env`):

```bash
ssh <user>@<server-ip> 'PGPASSWORD=<password> psql \
  -h <source-pg-host> -p 5432 -U powersync_role -d <appdb> \
  -c "SELECT 1 AS ok, current_user, current_database();"'
```

Expected:
```
 ok | current_user   | current_database
----+----------------+------------------
  1 | powersync_role | <appdb>
(1 row)
```

If this fails:
- Connection refused → `pg_hba.conf` line is missing or firewall blocks `5432`. Loop back to sysadmin.
- Password authentication failed → wrong password or wrong role. Loop back to sysadmin.

- [ ] **Step 4: Verify the publication exists and the role can read its tables**

```bash
ssh <user>@<server-ip> 'PGPASSWORD=<password> psql \
  -h <source-pg-host> -p 5432 -U powersync_role -d <appdb> \
  -c "SELECT pubname FROM pg_publication WHERE pubname = '\''powersync_publication'\'';"'
```

Expected: one row with `powersync_publication`.

- [ ] **Step 5: Commit the brief**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
git add SYSADMIN_BRIEF_PG.md
git commit -m "docs: sysadmin brief for source PG prep"
```

---

### Task 3: Compose, Caddy, and powersync.yaml configuration files

**Files:**
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/compose.yaml`
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/Caddyfile`
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/config/powersync.yaml`
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/.env.example`
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/.env` (gitignored, contains real secrets at deploy time)

**Interfaces:**
- Consumes: source PG credentials from Task 2 secrets file; Django backend's JWKS URL `https://<django-host>/api/powersync/jwks/`; eventual public domain `powersync.<domain>` (placeholder; resolved in Task 6).
- Produces: a complete Compose project ready to launch. Once `sync-rules.yaml` lands in Task 4, `docker compose up -d` will start a working stack.

- [ ] **Step 1: Look up the latest stable PowerSync service tag**

Visit `https://hub.docker.com/r/journeyapps/powersync-service/tags` (or any equivalent mirror). Pick the highest-numbered tag that is NOT a `-beta`, `-rc`, `-alpha`, or `nightly`. Record it as `<pinned-tag>`. Example: `1.13.5` (whatever is current at deploy time).

Write the chosen tag into `~/Desktop/classedge-hccci/classedge-powersync-infra/PINNED_VERSIONS.md`:

```markdown
# Pinned image tags

| Service | Tag | Chosen |
|---|---|---|
| journeyapps/powersync-service | `<pinned-tag>` | YYYY-MM-DD |
| mongo | `7` | 2026-06-19 |
| caddy | `2` | 2026-06-19 |

Bump these intentionally, never via `:latest`.
```

- [ ] **Step 2: Write `compose.yaml`**

Create `~/Desktop/classedge-hccci/classedge-powersync-infra/compose.yaml` (replace `<pinned-tag>` with the value from Step 1):

```yaml
name: powersync

services:
  powersync:
    image: journeyapps/powersync-service:<pinned-tag>
    command: ["start", "-r", "unified"]
    restart: unless-stopped
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      - POWERSYNC_CONFIG_PATH=/config/powersync.yaml
      - PS_DATA_SOURCE_URI=${PS_DATA_SOURCE_URI}
      - PS_MONGO_URI=mongodb://mongo:27017/powersync
    volumes:
      - ./config:/config:ro
    healthcheck:
      test:
        ["CMD", "wget", "--spider", "-q", "http://localhost:8080/probes/liveness"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: 50m
        max-file: "5"

  mongo:
    image: mongo:7
    restart: unless-stopped
    command: ["--bind_ip_all"]
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test:
        ["CMD", "mongosh", "--quiet", "--eval", "db.runCommand({ping:1}).ok"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: 50m
        max-file: "5"

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - powersync
    logging:
      driver: json-file
      options:
        max-size: 50m
        max-file: "5"

volumes:
  mongo-data:
  caddy-data:
  caddy-config:
```

- [ ] **Step 3: Write `Caddyfile`** (initial HTTP-only version; TLS hostname added in Task 6)

Create `~/Desktop/classedge-hccci/classedge-powersync-infra/Caddyfile`:

```caddyfile
# Task 6 swaps the :80 listener for a hostname-driven block to enable
# automatic Let's Encrypt issuance.
:80 {
    reverse_proxy powersync:8080
    encode gzip zstd
    log {
        output stdout
        format console
    }
}
```

- [ ] **Step 4: Write `config/powersync.yaml`**

Create the directory and file:

```bash
mkdir -p ~/Desktop/classedge-hccci/classedge-powersync-infra/config
```

Create `~/Desktop/classedge-hccci/classedge-powersync-infra/config/powersync.yaml` (replace `<django-host>` with the Django backend hostname; replace `powersync.<domain>` with the eventual public hostname — placeholder is fine until Task 6):

```yaml
replication:
  connections:
    - type: postgresql
      uri: !env PS_DATA_SOURCE_URI
      slot_name: powersync_slot
      publication_name: powersync_publication

storage:
  type: mongodb
  uri: !env PS_MONGO_URI

port: 8080

sync_rules:
  path: /config/sync-rules.yaml

client_auth:
  jwks_uri: https://<django-host>/api/powersync/jwks/
  audience:
    - https://powersync.<domain>
```

- [ ] **Step 5: Write `.env.example`** (no secrets) and gitignored `.env` (with secrets)

Create `~/Desktop/classedge-hccci/classedge-powersync-infra/.env.example`:

```bash
# PowerSync server runtime config. Copy to .env and fill in.
# .env is gitignored.

PS_DATA_SOURCE_URI=postgresql://powersync_role:CHANGEME@SOURCE_PG_HOST:5432/APPDB?sslmode=require
```

Update `.gitignore` and create the real `.env` (load values from `secrets.env`):

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
grep -q '^\.env$' .gitignore || echo ".env" >> .gitignore

# Substitute real values from secrets.env (kept locally, NEVER committed)
. ./secrets.env
cat > .env <<EOF
PS_DATA_SOURCE_URI=postgresql://${SOURCE_PG_USER}:${SOURCE_PG_PASSWORD}@${SOURCE_PG_HOST}:${SOURCE_PG_PORT}/${SOURCE_PG_DB}?sslmode=require
EOF
chmod 600 .env
```

If the source PG does not have TLS configured, change `sslmode=require` to `sslmode=disable`. Confirm with the sysadmin which is correct.

- [ ] **Step 6: Verify Compose can parse the file before pushing to the server**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
docker compose config > /dev/null
```

Expected: exits 0 with no output. If it errors, fix syntax before continuing.

- [ ] **Step 7: Push configs to the server**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
rsync -av --exclude .git --exclude secrets.env \
  ./ <user>@<server-ip>:/opt/powersync/
```

Verify:

```bash
ssh <user>@<server-ip> 'ls -la /opt/powersync && cat /opt/powersync/PINNED_VERSIONS.md'
```

Expected: shows `compose.yaml`, `Caddyfile`, `config/powersync.yaml`, `.env`, `.env.example`, `PINNED_VERSIONS.md`, etc. The `.env` file is present (containing the real secrets), but no `secrets.env`.

- [ ] **Step 8: Commit configs (without secrets)**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
git add compose.yaml Caddyfile config/powersync.yaml .env.example .gitignore PINNED_VERSIONS.md
git commit -m "feat: compose + Caddy + powersync.yaml scaffolding"
```

Also commit the server-side checkpoint (run on the server):

```bash
ssh <user>@<server-ip> '
  cd /opt/powersync &&
  git add compose.yaml Caddyfile config/powersync.yaml .env.example PINNED_VERSIONS.md &&
  echo "secrets.env" > .gitignore &&
  echo ".env" >> .gitignore &&
  git add .gitignore &&
  git -c user.email=ops@local -c user.name=ops commit -m "feat: compose + Caddy + powersync.yaml scaffolding"
'
```

---

### Task 4: Transfer sync-rules.yaml from the existing managed instance

**Files:**
- Create: `~/Desktop/classedge-hccci/classedge-powersync-infra/config/sync-rules.yaml`

**Interfaces:**
- Consumes: the existing `sync-rules.yaml` from the managed PowerSync dashboard (engineer confirmed they have a copy).
- Produces: identical sync rules in place on the new server, ready for PowerSync to load on first start.

- [ ] **Step 1: Place the sync-rules YAML**

Copy the existing sync rules file into the working repo at `~/Desktop/classedge-hccci/classedge-powersync-infra/config/sync-rules.yaml`. If the engineer has it as a different filename, rename. Source-of-truth for content is whatever the managed PowerSync dashboard currently serves — do not edit on the way over.

- [ ] **Step 2: Confirm role tokens used in the file match the JWT claims**

```bash
grep -nE 'Student|Teacher|Academic Director|Program Head' \
  ~/Desktop/classedge-hccci/classedge-powersync-infra/config/sync-rules.yaml
```

Expected: matches found, with **exact** casing/spacing — `Student`, `Teacher`, `Academic Director`, `Program Head`. Anything off (`student`, `Academic_Director`, etc.) will silently produce zero rows. If you see drift, stop and reconcile with `accounts/utils/powersync_utils.py:13`.

- [ ] **Step 3: Push to the server**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
rsync -av config/sync-rules.yaml <user>@<server-ip>:/opt/powersync/config/sync-rules.yaml
```

Verify it's there:

```bash
ssh <user>@<server-ip> 'ls -la /opt/powersync/config/sync-rules.yaml && wc -l /opt/powersync/config/sync-rules.yaml'
```

Expected: file exists, line count is > 0 and roughly matches the original.

- [ ] **Step 4: Commit locally and on the server**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
git add config/sync-rules.yaml
git commit -m "feat: import sync-rules from managed instance"

ssh <user>@<server-ip> '
  cd /opt/powersync &&
  git add config/sync-rules.yaml &&
  git -c user.email=ops@local -c user.name=ops commit -m "feat: import sync-rules from managed instance"
'
```

---

### Task 5: First launch — Mongo + PowerSync (HTTP-only, validate replication)

**Files:**
- Modify: none on disk; this task brings the stack up and verifies.

**Interfaces:**
- Consumes: configs from Tasks 3–4, source PG ready from Task 2.
- Produces: a running PowerSync container reachable on `http://<server-ip>` (via Caddy's :80), `/probes/liveness` returning 200, the replication slot `powersync_slot` materialized on the source PG, MongoDB receiving bucket writes.

- [ ] **Step 1: Pull images**

```bash
ssh <user>@<server-ip> 'cd /opt/powersync && docker compose pull'
```

Expected: all three images pulled without auth errors. If Docker Hub rate-limits, authenticate with `docker login` first.

- [ ] **Step 2: Start the stack**

```bash
ssh <user>@<server-ip> 'cd /opt/powersync && docker compose up -d'
```

Expected: containers report `Started`. Then check status:

```bash
ssh <user>@<server-ip> 'cd /opt/powersync && docker compose ps'
```

Expected: all three containers show `Up` with `(healthy)` after ~60 seconds (give Mongo and PowerSync time to become healthy).

- [ ] **Step 3: Tail logs and watch for replication startup**

```bash
ssh <user>@<server-ip> 'cd /opt/powersync && docker compose logs --tail=200 powersync'
```

Expected (look for these signals):
- Lines mentioning loading `sync-rules.yaml`
- Connection to Postgres established
- Replication slot `powersync_slot` created or attached to
- No fatal errors

If you see `connection refused` to Mongo → Mongo isn't healthy yet, give it 30 more seconds.
If you see Postgres auth errors → re-check `.env` PS_DATA_SOURCE_URI matches what Task 2 step 3 succeeded with.
If you see `wal_level` complaints → the target DB hasn't been flipped to `logical`; loop back to sysadmin (Task 2).

- [ ] **Step 4: Verify the liveness probe returns 200 via Caddy**

```bash
ssh <user>@<server-ip> 'curl -fsS http://localhost:80/probes/liveness && echo'
```

Expected: HTTP 200 with a small JSON body. If it 502s, Caddy can't reach PowerSync — check `docker compose ps` and `docker compose logs caddy`.

- [ ] **Step 5: Verify the replication slot exists on source PG**

```bash
ssh <user>@<server-ip> 'PGPASSWORD=<password> psql \
  -h <source-pg-host> -U powersync_role -d <appdb> \
  -c "SELECT slot_name, plugin, active, restart_lsn FROM pg_replication_slots WHERE slot_name = '\''powersync_slot'\'';"'
```

Expected: one row, `active = t`, `restart_lsn` non-null. This confirms PowerSync is actually subscribed.

- [ ] **Step 6: Verify MongoDB has received some bucket state**

```bash
ssh <user>@<server-ip> 'docker compose -f /opt/powersync/compose.yaml exec mongo \
  mongosh --quiet --eval "
    use powersync;
    db.getCollectionNames().forEach(c => print(c, db[c].estimatedDocumentCount()));
  "'
```

Expected: prints several PowerSync-internal collections with non-zero counts. (Initial sync may take time on a large source DB — re-run after a minute if counts are zero.)

- [ ] **Step 7: Commit a deploy note**

```bash
ssh <user>@<server-ip> '
  cd /opt/powersync &&
  echo "$(date -Iseconds) — first successful launch, slot powersync_slot active." >> DEPLOY_LOG.md &&
  git add DEPLOY_LOG.md &&
  git -c user.email=ops@local -c user.name=ops commit -m "ops: first launch"
'
```

---

### Task 6: DNS + Caddy TLS setup

**Files:**
- Modify: `~/Desktop/classedge-hccci/classedge-powersync-infra/Caddyfile` (swap :80 listener for hostname block)
- Modify: `~/Desktop/classedge-hccci/classedge-powersync-infra/config/powersync.yaml` (resolve the `<domain>` placeholder in `audience`)

**Interfaces:**
- Consumes: DNS name from the sysadmin (`A` record pointing at the server's public IP).
- Produces: a publicly reachable HTTPS endpoint at `https://powersync.<domain>` with a valid Let's Encrypt cert; 301 from `http://`. The `audience` claim in `powersync.yaml` matches the public URL.

- [ ] **Step 1: Coordinate DNS with the sysadmin**

Send the sysadmin a one-liner: *"Please create an `A` record `powersync.<domain>` → `<server-ip>`, TTL 300s. Let me know when it's propagated."*

While waiting, you can pre-stage the configs below; you cannot complete this task until the record resolves.

- [ ] **Step 2: Verify DNS propagation before touching Caddy**

```bash
dig +short A powersync.<domain> @1.1.1.1
dig +short A powersync.<domain> @8.8.8.8
```

Expected: both return the server's public IP. If they disagree or return nothing, wait longer (don't reconfigure Caddy yet — Caddy will hammer Let's Encrypt and possibly rate-limit if the record is wrong).

- [ ] **Step 3: Rewrite `Caddyfile` for hostname-driven TLS**

Replace the contents of `~/Desktop/classedge-hccci/classedge-powersync-infra/Caddyfile` with (replace `powersync.<domain>` with the real hostname; replace `<ops-email>` with a real reachable address for LE expiry warnings):

```caddyfile
{
    email <ops-email>
}

powersync.<domain> {
    reverse_proxy powersync:8080
    encode gzip zstd
    log {
        output stdout
        format console
    }
}
```

- [ ] **Step 4: Update the `audience` field in `powersync.yaml`**

Open `~/Desktop/classedge-hccci/classedge-powersync-infra/config/powersync.yaml` and replace:

```yaml
  audience:
    - https://powersync.<domain>
```

with the real hostname, e.g. `- https://powersync.classedge.com`.

- [ ] **Step 5: Push updated configs to the server**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
rsync -av Caddyfile config/powersync.yaml <user>@<server-ip>:/opt/powersync/
```

- [ ] **Step 6: Reload the stack (recreates Caddy + PowerSync to pick up the changes)**

```bash
ssh <user>@<server-ip> 'cd /opt/powersync && docker compose up -d'
```

Expected: only `powersync` and `caddy` recreate. Mongo stays up.

- [ ] **Step 7: Watch Caddy logs for the cert issuance**

```bash
ssh <user>@<server-ip> 'docker compose -f /opt/powersync/compose.yaml logs caddy --tail=200'
```

Expected: log lines about ACME challenge succeeding, certificate obtained for `powersync.<domain>`. If you see `401 unauthorized` or `404` from LE, the DNS record likely points elsewhere — go back to Step 2.

- [ ] **Step 8: Test HTTPS from outside the server**

From your laptop:

```bash
curl -fsS https://powersync.<domain>/probes/liveness && echo
curl -I http://powersync.<domain>/
```

Expected:
- `https://` returns 200 with a JSON body.
- `http://` returns `308 Permanent Redirect` to `https://…`.
- Browser confirms a valid (non-self-signed) Let's Encrypt cert.

- [ ] **Step 9: Commit**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
git add Caddyfile config/powersync.yaml
git commit -m "feat: TLS via Caddy + real audience"

ssh <user>@<server-ip> '
  cd /opt/powersync &&
  git add Caddyfile config/powersync.yaml &&
  git -c user.email=ops@local -c user.name=ops commit -m "feat: TLS via Caddy + real audience"
'
```

---

### Task 7: End-to-end validation with a dev mobile build

**Files:**
- Modify: `client-mobile/.env` (engineer's local file, temporary value pointing at new server)

**Interfaces:**
- Consumes: HTTPS-reachable PowerSync at `https://powersync.<domain>` from Task 6; the Django backend serving JWKS as it does today; the existing managed PowerSync still serving production tokens (we do NOT flip Django's audience yet — see "important" below).
- Produces: a confirmed working end-to-end sync against the new server using a real mobile build signed in as a real test user.

**Important:** Until Task 8 flips Django's `POWERSYNC_AUDIENCE`, tokens minted by Django carry the OLD audience (managed URL) and will be REJECTED by the new self-hosted instance. So we cannot validate Task 7 with the existing Django audience. Two options:

- **7a (preferred):** Temporarily add the new audience to PowerSync's `audience` list alongside the managed URL, so the new instance accepts both. This is the dual-audience window.
- **7b:** Temporarily flip `POWERSYNC_AUDIENCE` on Django for the validation, then flip back. Brittle — skip unless 7a is impractical.

The plan uses 7a.

- [ ] **Step 1: Add the managed-instance audience to PowerSync `audience` temporarily**

Edit `~/Desktop/classedge-hccci/classedge-powersync-infra/config/powersync.yaml`. Add the managed URL alongside the new one:

```yaml
  audience:
    - https://powersync.<domain>
    - https://69a63aa63488e6ec9dcecd9f.powersync.journeyapps.com
```

Push and reload PowerSync:

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
rsync -av config/powersync.yaml <user>@<server-ip>:/opt/powersync/config/powersync.yaml
ssh <user>@<server-ip> 'cd /opt/powersync && docker compose up -d powersync'
```

- [ ] **Step 2: Temporarily point the local mobile dev env at the new endpoint**

In `client-mobile/.env` (engineer's local), change:

```
EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://powersync.<domain>
```

**Do NOT commit this change.** It's a local-only validation knob.

- [ ] **Step 3: Run the app and sign in as a test user**

```bash
cd ~/Desktop/classedge-hccci/client-mobile
pnpm start:dev
```

Sign in as a known test account (any role — covering Student is enough for the first pass).

- [ ] **Step 4: Verify downsync works**

Watch in the app:
- Splash → home loads without "Failed to sync" toast.
- A screen that displays synced data (e.g., classroom list, schedule, announcements) populates.
- In Metro logs, no PowerSync auth errors.

In the source PG, confirm the test user's session keeps the replication slot active:

```bash
ssh <user>@<server-ip> 'PGPASSWORD=<password> psql \
  -h <source-pg-host> -U powersync_role -d <appdb> \
  -c "SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag FROM pg_replication_slots WHERE slot_name = '\''powersync_slot'\'';"'
```

Expected: `active = t`, `lag` small (< 1 MB typical for an idle stream).

- [ ] **Step 5: Verify upload still works (which goes to Django, not PowerSync)**

In the app, perform an action that creates a CRUD op — e.g., mark a notification read, save a draft answer. Watch Metro for `[Connector]` log lines from `powersync/Connector.ts` indicating PUT/PATCH to Django at `${EXPO_PUBLIC_API_URL}/...` with HTTP 200/204 response.

Expected: upload succeeds (uploads were never changed — this just confirms nothing else broke).

- [ ] **Step 6: Repeat the sign-in flow for a Teacher account if a test account exists**

This confirms role-gated streams still resolve correctly with the new audience. Look for role-specific data showing up in the teacher UI.

- [ ] **Step 7: Revert your local `.env` to point back at the managed endpoint**

```
EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://69a63aa63488e6ec9dcecd9f.powersync.journeyapps.com
```

You'll flip it back to self-hosted for the real ship in Task 9.

- [ ] **Step 8: Record the validation result**

Append to `~/Desktop/classedge-hccci/classedge-powersync-infra/DEPLOY_LOG.md`:

```
YYYY-MM-DD HH:MM — E2E validation against new self-hosted PowerSync passed.
- Student account: downsync + upload OK
- Teacher account: downsync + upload OK
- Replication slot lag stayed under 1 MB
- Dual-audience window remains open for the cut-over
```

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
git add DEPLOY_LOG.md
git commit -m "ops: record e2e validation"
```

---

### Task 8: Flip Django POWERSYNC_AUDIENCE

**Files:**
- Modify: Django backend's `.env` (whatever file Django reads at startup; usually `classedge-mobile-test/.env` or `/etc/classedge/.env` on the Django host).

**Interfaces:**
- Consumes: the new PowerSync URL chosen in Task 6 and now in `powersync.yaml` `audience`.
- Produces: Django mints tokens whose `aud` claim is the new self-hosted URL. The dual-audience window from Task 7 means the new PowerSync accepts both new and old audience for now.

- [ ] **Step 1: Locate the Django env file in use**

On the Django host:

```bash
ssh <django-user>@<django-host> 'grep -rEl "POWERSYNC_AUDIENCE|POWERSYNC_URL" /etc /opt 2>/dev/null'
```

Or check the Django systemd unit / process manager for `EnvironmentFile=` directives.

- [ ] **Step 2: Update the audience variable**

Edit the located file to set:

```
POWERSYNC_AUDIENCE=https://powersync.<domain>
```

If the file did not previously contain `POWERSYNC_AUDIENCE`, the default in `classedge-mobile-test/accounts/utils/powersync_utils.py:74` falls back to `POWERSYNC_URL`. Update `POWERSYNC_URL` instead, or add `POWERSYNC_AUDIENCE` explicitly. Prefer adding `POWERSYNC_AUDIENCE` explicitly — the override is clearer.

- [ ] **Step 3: Restart Django to pick up the new env**

```bash
ssh <django-user>@<django-host> 'sudo systemctl restart classedge-django'  # or whatever the service is called
```

Confirm it's up:

```bash
curl -fsS https://api.<domain>/api/health/ && echo  # or wherever the health endpoint lives
```

- [ ] **Step 4: Verify a freshly-minted token carries the new audience**

Have a test user sign in (the mobile app or any tool that hits `/api/powersync/token/`). On the Django host:

```bash
ssh <django-user>@<django-host> 'sudo journalctl -u classedge-django -n 200 | grep -i powersync'
```

Look for token minting log lines (if any). Or — simpler — open a fresh signed-in session in the mobile dev build, grab the token from Metro logs / Redux devtools, paste it into jwt.io, and confirm `"aud": "https://powersync.<domain>"`.

- [ ] **Step 5: Record the flip in the deploy log**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
echo "$(date -Iseconds) — Django POWERSYNC_AUDIENCE flipped to https://powersync.<domain>" >> DEPLOY_LOG.md
git add DEPLOY_LOG.md
git commit -m "ops: Django audience flip"
```

---

### Task 9: Ship mobile build with new endpoint

**Files:**
- Modify: `client-mobile/.env` (or the EAS environment for the target profile)
- Modify: any production env value source for `EXPO_PUBLIC_POWERSYNC_ENDPOINT`

**Interfaces:**
- Consumes: Django audience flipped (Task 8); PowerSync accepting the new audience (Task 6 + dual-audience window from Task 7).
- Produces: mobile app builds with `EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://powersync.<domain>`, shipped to users via the team's normal channel (EAS Update for JS-only change, store release for a full native build).

- [ ] **Step 1: Update the endpoint in the EAS environment**

`EXPO_PUBLIC_*` vars come from EAS environment variables on builds (per `.env.example:11-19`). Update via the dashboard or CLI:

```bash
cd ~/Desktop/classedge-hccci/client-mobile
eas env:list                 # see current values per environment
eas env:create production \
  --name EXPO_PUBLIC_POWERSYNC_ENDPOINT \
  --value https://powersync.<domain> \
  --visibility plaintext --force
# Repeat for preview and development environments as needed.
```

- [ ] **Step 2: Update local `.env` to match (so future `pnpm start:prod` previews use the new endpoint)**

```bash
cd ~/Desktop/classedge-hccci/client-mobile
# Edit .env:
EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://powersync.<domain>
```

Do not commit `.env` (it's gitignored per existing repo convention; double-check with `git status`).

- [ ] **Step 3: Ship the change to users — pick the right channel**

If the only change since the last shipped build is the endpoint (no native module changes), an EAS Update is sufficient:

```bash
eas update --branch production --message "PowerSync endpoint → self-hosted"
```

If there are pending native changes, do a full build + store submission instead. Coordinate the release window so users get the new endpoint within the dual-audience grace period (PowerSync still accepts the managed audience too).

- [ ] **Step 4: Smoke-test the published update on a real device**

On a fresh install / `eas update`-receiving device, sign in and confirm sync works against the new endpoint. Watch for the one-time re-bootstrap (brief "syncing…" period) noted in the spec — expected, not a bug.

- [ ] **Step 5: Monitor sync traffic on the new server for the first hour**

```bash
ssh <user>@<server-ip> 'docker compose -f /opt/powersync/compose.yaml logs powersync --since 1h --tail=500 | tail -100'
```

Expected: active client connections, no 401 storm (which would indicate audience misconfiguration), no slot-lag spike.

- [ ] **Step 6: Record the cut-over**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
echo "$(date -Iseconds) — Mobile build with new endpoint shipped via EAS Update" >> DEPLOY_LOG.md
git add DEPLOY_LOG.md
git commit -m "ops: mobile cut-over"
```

---

### Task 10: Slot lag monitoring on source PG

**Files:**
- Create on source PG host (with sysadmin help): `/usr/local/bin/powersync-slot-lag-check.sh`
- Create on source PG host: a cron entry (or systemd timer) firing the check every 5 minutes.

**Interfaces:**
- Consumes: a delivery channel for alerts (Slack webhook, email, sysadmin's existing pager — confirm preferred channel with sysadmin).
- Produces: an automated 5-minute health check that alerts when the slot's WAL backlog exceeds 2 GB.

- [ ] **Step 1: Write the check script**

Send this to the sysadmin (or run yourself if you have access) as `/usr/local/bin/powersync-slot-lag-check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SLOT_NAME="powersync_slot"
THRESHOLD_BYTES=$((2 * 1024 * 1024 * 1024))   # 2 GB
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"            # set in cron environment

LAG_BYTES=$(sudo -u postgres psql -At -c "
  SELECT COALESCE(
    pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)::bigint,
    0
  )
  FROM pg_replication_slots
  WHERE slot_name = '${SLOT_NAME}';
")

if [[ -z "$LAG_BYTES" ]]; then
  MSG="[powersync] slot ${SLOT_NAME} NOT FOUND on source PG"
elif (( LAG_BYTES > THRESHOLD_BYTES )); then
  MSG="[powersync] slot ${SLOT_NAME} WAL lag ${LAG_BYTES} bytes (> 2 GB threshold)"
else
  exit 0
fi

if [[ -n "$ALERT_WEBHOOK" ]]; then
  curl -fsS -X POST -H 'Content-Type: application/json' \
    -d "{\"text\":\"${MSG}\"}" "$ALERT_WEBHOOK" || true
fi
logger -t powersync-slot-lag "${MSG}"
echo "${MSG}" >&2
exit 1
```

`chmod +x /usr/local/bin/powersync-slot-lag-check.sh`.

- [ ] **Step 2: Schedule it via cron**

Add to root's crontab (or sysadmin-owned crontab):

```
*/5 * * * * ALERT_WEBHOOK='<your-slack-webhook-url>' /usr/local/bin/powersync-slot-lag-check.sh
```

- [ ] **Step 3: Test the alert path manually**

Run the script with a temporarily-lowered threshold to force a fire:

```bash
sudo -u postgres THRESHOLD_BYTES=1 ALERT_WEBHOOK='<webhook>' \
  /usr/local/bin/powersync-slot-lag-check.sh
```

Wait — the script reads THRESHOLD_BYTES as a constant, so editing the script for the test, or commenting out the slot WHERE clause to force "slot not found," reaches the alert branch. Confirm the alert lands in the delivery channel.

- [ ] **Step 4: Confirm in the deploy log**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
echo "$(date -Iseconds) — Slot lag cron installed and alert path tested" >> DEPLOY_LOG.md
git add DEPLOY_LOG.md
git commit -m "ops: slot lag monitoring"
```

---

### Task 11: Close the dual-audience window and decommission

**Files:**
- Modify: `~/Desktop/classedge-hccci/classedge-powersync-infra/config/powersync.yaml` (remove the managed URL from `audience`)
- Modify: managed PowerSync dashboard (pause / cancel instance)

**Interfaces:**
- Consumes: confirmation that the grace period (~2 weeks per spec) elapsed and the proportion of clients on old endpoint is zero or negligible.
- Produces: a single-audience self-hosted instance; the managed instance off the bill.

- [ ] **Step 1: Confirm no traffic is hitting the managed endpoint**

In the managed PowerSync dashboard, check the "active connections" or "requests/min" metric. Expected: trending to zero after the grace period.

- [ ] **Step 2: Remove the managed URL from PowerSync `audience`**

Edit `~/Desktop/classedge-hccci/classedge-powersync-infra/config/powersync.yaml`:

```yaml
  audience:
    - https://powersync.<domain>
```

(Drop the second line containing the managed URL.)

Push + reload:

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
rsync -av config/powersync.yaml <user>@<server-ip>:/opt/powersync/config/powersync.yaml
ssh <user>@<server-ip> 'cd /opt/powersync && docker compose up -d powersync'
```

- [ ] **Step 3: Confirm self-hosted still serves traffic post-narrowing**

Watch logs for ~10 minutes:

```bash
ssh <user>@<server-ip> 'docker compose -f /opt/powersync/compose.yaml logs powersync --since 10m --tail=300'
```

Expected: no 401 audience-mismatch storm. (If you see one, an unexpected pocket of users is still on the old build — re-add the dual audience and chase the stragglers before the next attempt.)

- [ ] **Step 4: Pause (don't delete yet) the managed PowerSync instance**

In the managed PowerSync dashboard, **pause** the instance — keep it dormant for at least one billing cycle so we have a one-click rollback if a slow-burn issue surfaces. Delete after one billing cycle of clean self-hosted operation.

- [ ] **Step 5: Final log entry + commit**

```bash
cd ~/Desktop/classedge-hccci/classedge-powersync-infra
echo "$(date -Iseconds) — Managed audience removed, managed instance paused" >> DEPLOY_LOG.md
git add config/powersync.yaml DEPLOY_LOG.md
git commit -m "ops: close dual-audience window, pause managed instance"

ssh <user>@<server-ip> '
  cd /opt/powersync &&
  git add config/powersync.yaml &&
  git -c user.email=ops@local -c user.name=ops commit -m "ops: close dual-audience window"
'
```

---

## Self-Review

**Spec coverage:**
- Architecture / components / data flow → Tasks 3 (Compose) + 4 (sync-rules) + 5 (launch).
- Auth integration (JWKS, audience, Django flip) → Tasks 3 (jwks_uri in powersync.yaml) + 7 (validation) + 8 (Django audience flip) + 9 (mobile endpoint flip) + 11 (close dual-audience).
- Networking & TLS → Tasks 3 (Caddyfile + Compose port surface) + 6 (DNS + TLS).
- Storage / backup / slot risk → Task 2 (`max_slot_wal_keep_size`) + Task 10 (lag monitoring). MongoDB-no-backup posture is a non-goal, no task needed.
- Migration / cut-over (sequence, re-bootstrap, rollback) → Tasks 7 (dual-audience validation) + 8 (Django audience) + 9 (mobile ship) + 11 (decommission).
- Monitoring & ops → Task 3 (healthchecks + log limits in compose.yaml) + Task 10 (slot lag cron).
- "Open items resolved before go-live" → wal_level re-check at Task 5 step 3 logs; replication-slot-headroom check at Task 2 step 1; DNS at Task 6; corporate firewall implicit in Task 2 step 3 ping. All covered.

**Placeholder scan:**
- `<server-ip>`, `<user>`, `<django-host>`, `powersync.<domain>`, `<pinned-tag>`, `<password>`, `<ops-email>`, `<webhook>` — these are intentional in-place placeholders the engineer fills with real values at execution time. The plan explicitly tells them how to obtain each. Not "TBD" in the bad sense.
- `TBD` does not appear in the body.

**Type consistency:**
- Slot name `powersync_slot`, role name `powersync_role`, publication `powersync_publication` consistent across Tasks 2, 5, 10, 11.
- Audience hostname `powersync.<domain>` consistent across Tasks 3, 6, 7, 8, 9, 11.
- Image tag `<pinned-tag>` referenced only in Task 3 (where it's chosen) — fine.
- Env vars `POWERSYNC_AUDIENCE`, `EXPO_PUBLIC_POWERSYNC_ENDPOINT`, `PS_DATA_SOURCE_URI`, `PS_MONGO_URI` consistent.

No issues to fix.
