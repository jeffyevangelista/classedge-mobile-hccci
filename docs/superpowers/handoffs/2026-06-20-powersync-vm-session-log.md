# Self-hosted PowerSync — chronological session log

> Companion to [`2026-06-20-powersync-vm-state.md`](2026-06-20-powersync-vm-state.md). That doc is the *what works* — this one is the *what we tried, what failed, and how we got there*. Read this if you want context on *why* the final architecture looks the way it does. Skip if you just want to deploy.

The stand-up happened across one extended pairing session on 2026-06-19 → 2026-06-20. Below is the sequence of events as they actually unfolded.

---

## Phase 1 — Bare VM, first stack stand-up (2026-06-19)

**Starting state:** Ubuntu VM with only Docker installed. User SSHed in as `jeffy`. Goal: get PowerSync running against *something* — even a throwaway DB — to validate the moving parts before real DB credentials arrive.

### Misstep 1: User not in `docker` group

First `docker compose pull` returned:

```
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```

`groups` showed `jeffy sudo users` — no `docker`. Fix:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

`newgrp docker` activated the group in the current shell without requiring a logout. `docker run --rm hello-world` confirmed.

**Lesson:** the official Docker install script doesn't auto-add the invoking user to the group. Add to the prereq checklist.

### Misstep 2: Heredoc paste added leading whitespace

First `cat > compose.yaml <<'EOF' … EOF` looked fine when typed but `cat -A` revealed every line had been prefixed with two spaces by the terminal's auto-indent. YAML happens to be tolerant of consistently-indented top-level keys, so it parsed — but this set up a recurring pattern: **multi-line pastes through SSH are unreliable**.

Pattern across the session:

- `cat <<'EOF'` — sometimes auto-indented
- `printf '...'` — wrapped at terminal width, broke long lines
- `nano` — worked reliably
- `sed -i` — worked reliably for single-line surgical edits

By the time we got to `config/powersync.yaml`, we'd been bitten enough times that `printf 'replication:\n  connections:\n…path: /config/sync-rules.yaml\n…'` got wrapped mid-`path:` and produced this invalid YAML:

```yaml
sync_rules:
  path:                       
  /config/sync-rules.yaml
```

PowerSync's YAML parser rejected it with `Implicit map keys need to be followed by map values`. Fixed with a targeted `sed`:

```bash
sed -i -e '/^  path:[[:space:]]*$/{N;s|.*|  path: /config/sync-rules.yaml|}' config/powersync.yaml
```

**Lesson:** when in doubt, `nano`. Multi-line `printf` is fragile through SSH.

### Stand-up: write the four files

Eventually got these landed cleanly in `~/powersync/`:

- `compose.yaml` — powersync + mongo + throwaway source-pg
- `init-source-pg.sql` — `CREATE PUBLICATION powersync FOR ALL TABLES;`
- `.env` — `PS_DATA_SOURCE_URI=postgresql://powersync_role:powersync_test_password@source-pg:5432/testdb?sslmode=disable`
- `config/powersync.yaml` — replication / storage / sync_rules / client_auth (with placeholder JWKS + audience)
- `config/sync-rules.yaml` — user pasted in their existing managed-instance rules

### Boot attempt 1: MongoDB replica-set requirement

`docker compose up -d` came up but powersync went `Restarting (1)` immediately. Logs:

```
MongoServerError: Transaction numbers are only allowed on a replica set member or mongos
```

PowerSync uses MongoDB transactions for atomic bucket updates; standalone `mongod` rejects them. Fix:

1. `command: ["mongod", "--replSet", "rs0", "--bind_ip_all"]` on the mongo service
2. Idempotent `rs.initiate()` baked into the healthcheck so it self-initiates on first boot and self-verifies on subsequent boots
3. `?replicaSet=rs0` appended to the PowerSync→Mongo URI

Wiped the mongo volume (`docker volume rm powersync_mongo-data`) since it had been initialized as standalone, brought it back up, healthy.

### Boot attempt 2: SSL handshake failure

Next error:

```
Replication error postgres does not support ssl
```

Despite `?sslmode=disable` in `PS_DATA_SOURCE_URI`. Verified the env var was reaching the container correctly — `docker compose exec powersync printenv PS_DATA_SOURCE_URI` showed the URI with `?sslmode=disable`. So the URI's query parameter was being ignored.

Discovery: **PowerSync's own config schema has a `sslmode` field that defaults to `verify-full` and overrides the URI**. Added `sslmode: disable` to the connection block in `powersync.yaml`. Resolved.

### Boot attempt 3: Publication-name mismatch

Next error:

```
[PSYNC_S1141] Publication 'powersync' does not exist.
Run: CREATE PUBLICATION powersync FOR ALL TABLES
```

But our `powersync.yaml` had `publication_name: powersync_publication`, and `init-source-pg.sql` created `powersync_publication`. PowerSync was looking for the default name (`powersync`) regardless.

Tried setting `publication_name:` correctly in the YAML — no effect. The field is either renamed or removed in v1.22.0's schema. Rather than chase the exact schema field, we aligned to PowerSync's default: dropped the override, renamed the publication in `init-source-pg.sql` to `powersync`, wiped the source-pg volume so init would re-run.

(Same applies to `slot_name` — PowerSync auto-generates names like `powersync_1_e15a` and there's no clean way to override in 1.22.0.)

### Stack green

Logs eventually printed:

```
[powersync_1_e15a] Initial replication already done
[powersync_1_e15a] Replicating op 0 00000000/01966C40
```

That's the goal state — initial snapshot done, tailing live WAL.

### Reboot resilience verified

`sudo reboot`, wait ~30s, SSH back, `docker compose ps`:

- `mongo` (healthy)
- `source-pg` (healthy)
- `powersync` (health: starting → healthy)

Liveness probe returned 200 immediately. `restart: unless-stopped` does its job; mongo's healthcheck idempotently re-attached to its replica set; PowerSync re-acquired the slot.

---

## Phase 2 — Auth wiring (2026-06-19 → 2026-06-20)

### JWKS URL update

The `placeholder` `https://example.invalid/jwks` was replaced with the real Django endpoint:

```bash
sed -i 's|https://example.invalid/jwks|https://classedge.hccci.edu.ph/api/powersync/jwks/|' config/powersync.yaml
```

The endpoint wasn't yet deployed on the Django side at this point, but PowerSync fetches JWKS lazily (only when validating an incoming client token), so the stack stayed green.

### Audience: choosing a stable identifier

User confirmed Django's `POWERSYNC_AUDIENCE` is the string `powersync-classedge` — a label, not a URL. This was a quiet win: because the audience isn't tied to the server's URL, **it doesn't need to change when the public hostname is eventually assigned**. No dual-audience cut-over dance.

```bash
sed -i 's|- http://localhost:8080|- powersync-classedge|' config/powersync.yaml
```

### JWKS endpoint live — verified

Once backend confirmed deployment:

```bash
curl -s https://classedge.hccci.edu.ph/api/powersync/jwks/ | head -c 300
# {"keys":[{"kty":"RSA","use":"sig","alg":"RS256","kid":"b0a72e72c7b8b6ce","n":"..."}]}
```

Valid RSA/RS256 keyset with `kid` — auth chain proven from the VM's side.

---

## Phase 3 — Source DB coordination (2026-06-20)

### URL arrived with `localhost`

DB admin shared a URL whose host was `localhost`. Quick clarification: `localhost` is always per-machine — from the VM, it means *the VM*, not the DB server. Needed the **private IP** of the DB server on the shared network. The admin came back with `172.16.0.56` — same private network as the VM.

### Reachability checks before psql

```bash
sudo apt-get install -y postgresql-client    # Ubuntu's suggestion of postgresql-client-common is wrong; that package doesn't contain psql
getent hosts 172.16.0.56                     # DNS
nc -zv 172.16.0.56 5432                       # TCP port
```

Network path confirmed. Then connection test:

```bash
DB="postgresql://newcollegelms:<URL-encoded-pw>@172.16.0.56:5432/newcollegelms?sslmode=disable"
psql "$DB" -c "SELECT 1 AS ok;"
# → 1
```

### DB-admin coordination, round 1: REPLICATION privilege

Verification query showed:

```
    rolname    | rolreplication 
---------------+----------------
 newcollegelms | f
```

DB admin granted: `ALTER ROLE newcollegelms WITH REPLICATION;`. Came back as `t`.

Also noticed: `max_slot_wal_keep_size = -1` (uncapped). Recommended setting it; admin did, `10240` (10 GB) on next check.

### DB-admin coordination, round 2: Publication missing

```
 pubname | puballtables 
---------+--------------
(0 rows)
```

Tried to create it ourselves as `newcollegelms`:

```
ERROR: must be superuser to create FOR ALL TABLES publication
```

Sent to the admin. They ran `CREATE PUBLICATION powersync FOR ALL TABLES;`. Got back `ERROR: publication "powersync" already exists` on a follow-up — but our verification still showed 0 rows.

**Trap revealed:** publications are **per-database**. Their `psql` prompt said `postgres=#` — they'd created it in the `postgres` admin DB, not `newcollegelms`. Fix:

```sql
\c newcollegelms
CREATE PUBLICATION powersync FOR ALL TABLES;
```

Verification confirmed.

---

## Phase 4 — Flipping to the real DB (2026-06-20)

### `pgwire` URL-decoding gotcha

Updated `.env` with the real URI, `docker compose up -d --force-recreate powersync`. Logs:

```
PgError.28P01: password authentication failed for user "newcollegelms"
```

But `psql` with the same URL had succeeded from the same VM. Diagnosis:

- The password contains `]`, `{`, `@`, `<`, `\` — all URL-encoded in the URI (`%5D`, `%7B`, `%40`, `%3C`, `%5C`)
- `psql` (libpq) URL-decodes the password before sending to PG → PG accepts
- PowerSync uses the `pgwire` JS driver, which doesn't URL-decode the same way → PG sees the URL-encoded literal as the password → rejects

Two possible fixes:

1. Don't URL-encode anywhere — switch to discrete connection fields and pass the literal password as an env var
2. Patch pgwire (not realistic)

Went with (1):

**`.env`:**
```
PS_PG_HOSTNAME=172.16.0.56
PS_PG_PORT=5432
PS_PG_DATABASE=newcollegelms
PS_PG_USERNAME=newcollegelms
PS_PG_PASSWORD='o]1x{@4<\5R2'    # single-quoted; backslashes preserved
```

**`powersync.yaml`** connection block:
```yaml
- type: postgresql
  hostname: !env PS_PG_HOSTNAME
  port: !env PS_PG_PORT
  database: !env PS_PG_DATABASE
  username: !env PS_PG_USERNAME
  password: !env PS_PG_PASSWORD
  sslmode: disable
```

### `.env` vs `env_file` gotcha

After the swap, PowerSync booted with `Attempted to substitute environment variable "PS_PG_HOSTNAME" which is undefined`. Despite the vars being in `.env`.

**Discovery:** Compose's `.env` file is loaded for *interpolation into `compose.yaml`*. Variables don't automatically propagate into containers' environments. Fix is either:

- List each var in the service's `environment:` block as `- PS_PG_HOSTNAME=${PS_PG_HOSTNAME}` (verbose)
- Add `env_file: [.env]` to the service (clean, pulls the whole file in)

Went with `env_file:`. After restart:

```
[powersync_2_b050] Replicating "public"."activity_activity" 0/? - resumable
[powersync_2_b050] Replicating "public"."activity_activityquestion" 0/? - resumable
...
[powersync_2_b050] Activated new replication stream at 00000003/25D98B38
[powersync_1_e15a] Terminating replication stream...
Cleaning up Postgres replication slot: powersync_1_e15a...
```

Real DB connected. New slot live. Old throwaway slot cleanly torn down.

### Removing the throwaway

Edited `compose.yaml` — deleted the `source-pg:` service block, the `source-pg: condition: service_healthy` lines under `powersync.depends_on:`, and the `source-pg-data:` entry in the top-level `volumes:`. `docker compose down --remove-orphans` was needed to actually remove the orphan source-pg container (regular `down` left it as an orphan; the `--remove-orphans` flag was the fix). Then `docker volume rm powersync_source-pg-data`. Down to two services.

### Healthcheck wedged: `wget` missing

After the down/up cycle, powersync stayed `(unhealthy)` indefinitely despite the service working fine. Direct curl to liveness returned 200; the container's healthcheck didn't.

```bash
docker compose exec powersync wget --spider -q http://localhost:8080/probes/liveness
# OCI runtime exec failed: exec failed: unable to start container process:
# exec: "wget": executable file not found in $PATH
```

The PowerSync image ships without `wget` (or `curl`). Replaced the healthcheck with Node's built-in `fetch`:

```yaml
test: ["CMD", "node", "-e", "fetch('http://localhost:8080/probes/liveness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
```

Container flipped to `(healthy)` on the next check.

---

## Phase 5 — End-to-end smoke test (2026-06-20)

### `cloudflared` quick tunnel

Sysadmin still hadn't assigned the permanent hostname, but we wanted to prove the auth+sync chain end-to-end from a real mobile build. Quick tunnel:

```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
cloudflared tunnel --url http://localhost:8080
```

Prints a `https://<words>.trycloudflare.com` URL → routes to PowerSync's `:8080`. From the laptop:

```bash
curl -s https://<words>.trycloudflare.com/probes/liveness && echo
# {"ready":true,"started":true,...}
```

Pointed `client-mobile/.env`'s `EXPO_PUBLIC_POWERSYNC_ENDPOINT` at the tunnel URL. Signed in as a real user. Real classroom data populated; no `401` storm; PowerSync logs showed `Replicating op …` keep incrementing as the app was used. Slot lag on the source DB stayed sub-MB while idle.

End-to-end proven.

---

## Phase 6 — Architecture clarification (2026-06-20)

### Port + TLS on a private-network deployment

User asked: "if the VM has TLS, should it be on 8080?" Worked through:

- TLS conventionally lives on `443`
- PowerSync doesn't terminate TLS itself; needs a proxy upstream
- VM is on a private network with no public IP → the sysadmin's existing gateway terminates `443` and forwards plaintext to the VM
- VM's listener stays at `8080`; no change needed
- Mobile sees `https://hostname` (port 443 implicit); VM never sees port 443 traffic

Conclusion: hand sysadmin the VM's private IP + port `8080`. No Caddy on the VM in this deployment. (If we ever stand up another deployment with no upstream gateway, add Caddy at that time.)

---

## Phase 7 — Final state

Two healthy services, real DB connected, real publication, auth wired, audience confirmed, cloudflared smoke test passed. The only thing left is the sysadmin assigning the permanent public hostname so cloudflared can retire.

End state details: [`2026-06-20-powersync-vm-state.md`](2026-06-20-powersync-vm-state.md).

---

## Time accounting

Rough breakdown of where the session's hours went:

| Activity | Approx time | Why so long |
|---|---|---|
| Initial three-file write-out + first boot | 30 min | Heredoc/terminal paste issues recurring |
| Mongo replica-set fix | 15 min | Once identified, straightforward |
| SSL/publication name iteration | 30 min | Schema field-name guessing |
| Auth config + JWKS verify | 15 min | Clean once JWKS endpoint deployed |
| Source DB coordination (across multiple back-and-forths) | 1–2 hours real time, ~30 min active | REPLICATION grant, then publication, then per-DB trap |
| pgwire URL-decoding diagnosis + discrete fields | 45 min | Misleading error message ("password authentication failed" — could've been pg_hba.conf) |
| env_file discovery | 15 min | Compose docs on this are clear once you know to look |
| Throwaway PG removal + orphan cleanup | 10 min | Quick |
| Healthcheck wget→node fetch | 15 min | Once diagnosed |
| cloudflared install + tunnel + mobile test | 20 min | Smooth |
| TLS/port architecture conversation | 10 min | |
| **Total focused work** | **~4 hours** | |

For a clean re-deploy with all this knowledge applied, expect **~20–40 minutes** if external dependencies (DB prep, JWKS endpoint) are ready.
