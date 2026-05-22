# PowerSync Public Trusted Cert via TryCloudflare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing self-hosted PowerSync container at a publicly trusted HTTPS URL using a free TryCloudflare quick tunnel, and point the mobile preview app at the new URL.

**Architecture:** Add a `cloudflared` sibling container to the existing `~/powersync-server/` compose stack that opens an outbound HTTP/2 tunnel from the VM to Cloudflare. PowerSync stays on `http://powersync:8080` inside the docker network; clients hit a public `https://<random>.trycloudflare.com` URL served by the Cloudflare edge with a trusted cert. Caddy + the LAN path are untouched.

**Tech Stack:** Docker Compose (already in use on VM), `cloudflare/cloudflared:latest`, Expo (React Native) env vars validated by zod.

**Reference spec:** `docs/superpowers/specs/2026-05-22-powersync-public-cert-design.md`

**Verification approach:** No automated tests apply — this is an infrastructure change. Each task is verified by an explicit `curl` / `docker compose logs` check or a manual app-on-device check. The final task is the end-to-end check from the preview app.

**Environments used by this plan:**
- **VM** — SSH to `classify@172.16.30.85`, work inside `~/powersync-server/`. Tasks 1–4.
- **Local mac (this repo)** — work inside `client-mobile/`. Task 5.
- **Mobile device** — iOS/Android preview app build. Task 6.

Every task header states which environment its steps run in.

---

## File Structure

**On the VM (`~/powersync-server/`)**
- Modify: `docker-compose.yml` — add a `cloudflared` service
- Create: `scripts/tunnel-url.sh` — helper that prints the current tunnel URL from `cloudflared` logs

**In `client-mobile/`**
- Modify: `.env` (gitignored) — set `EXPO_PUBLIC_POWERSYNC_ENDPOINT` to the new tunnel URL and fix the existing `https:/` typo

No code changes in the mobile app — the endpoint is already env-driven (validated at `utils/env.ts:7-9`, consumed at `powersync/Connector.ts:115`).

---

## Task 1: Inspect the current compose file on the VM

Read the existing `docker-compose.yml` so the new service is added with consistent indentation, network, and quoting style. Do not edit yet.

**Environment:** VM (`classify@172.16.30.85`, inside `~/powersync-server/`).

- [ ] **Step 1: SSH in and print the compose file**

```bash
ssh classify@172.16.30.85 'cat ~/powersync-server/docker-compose.yml'
```

Expected: A YAML file with at least a `services:` block containing `powersync:` (port 8080) and `mongo:` and `caddy:` services. Confirm the existing indentation width (2 vs 4 spaces) and whether there's an explicit `networks:` section.

- [ ] **Step 2: Confirm the service name**

Look for `services:\n  powersync:` (or similar) — the service name is what `cloudflared` will target via `http://<service>:8080`. Per the project memory the service is `powersync`. If it is anything else, substitute that name in Task 2.

No commit — read-only.

---

## Task 2: Add the `cloudflared` service to `docker-compose.yml`

Add a new service that runs `cloudflare/cloudflared:latest` with the anonymous quick-tunnel command. The service has no volumes, no env, no credentials.

**Environment:** VM, inside `~/powersync-server/`.

**Files:**
- Modify: `~/powersync-server/docker-compose.yml`

- [ ] **Step 1: Back up the current compose file**

```bash
ssh classify@172.16.30.85 'cp ~/powersync-server/docker-compose.yml ~/powersync-server/docker-compose.yml.bak.2026-05-22'
```

Expected: no output, file copied. Verify with `ls -l ~/powersync-server/docker-compose.yml.bak.2026-05-22`.

- [ ] **Step 2: Append the cloudflared service**

Edit `~/powersync-server/docker-compose.yml` (use `vim`, `nano`, or paste a heredoc via SSH). Add this block under the existing `services:` map, indented to match the sibling services (assume 2-space indentation as is the docker compose convention — if Task 1 showed 4 spaces, double these indents):

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate --url http://powersync:8080
    depends_on:
      - powersync
```

If the compose file defines an explicit `networks:` section that the other services join, add the same `networks:` key to `cloudflared` so it can resolve `powersync` by DNS. If no explicit network is defined, do nothing — compose's default network covers it.

- [ ] **Step 3: Validate the compose file syntax**

```bash
ssh classify@172.16.30.85 'cd ~/powersync-server && sudo docker compose config >/dev/null'
```

Expected: no output, exit 0. If there is a YAML error, fix indentation and re-run.

- [ ] **Step 4: Verify the new service is listed**

```bash
ssh classify@172.16.30.85 'cd ~/powersync-server && sudo docker compose config --services'
```

Expected: a list including `powersync`, `mongo`, `caddy`, and now `cloudflared`.

No commit — `~/powersync-server/` is not assumed to be a git repo. The `.bak` file is the rollback.

---

## Task 3: Create the `tunnel-url.sh` helper

Add a small script that prints the current `*.trycloudflare.com` URL from `cloudflared` logs. This is the operator's one-liner each test session.

**Environment:** VM, inside `~/powersync-server/`.

**Files:**
- Create: `~/powersync-server/scripts/tunnel-url.sh`

- [ ] **Step 1: Create the scripts directory and the file**

```bash
ssh classify@172.16.30.85 'mkdir -p ~/powersync-server/scripts && cat > ~/powersync-server/scripts/tunnel-url.sh' <<'EOF'
#!/usr/bin/env bash
# Print the current TryCloudflare URL from the cloudflared service logs.
# Exits non-zero if no URL is found (e.g. service not yet up, or logs rotated).

set -euo pipefail

cd "$(dirname "$0")/.."

URL="$(sudo docker compose logs --no-color cloudflared 2>/dev/null \
  | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' \
  | tail -n 1)"

if [[ -z "${URL}" ]]; then
  echo "No trycloudflare.com URL found in cloudflared logs." >&2
  echo "Hint: 'sudo docker compose up -d cloudflared' then re-run." >&2
  exit 1
fi

echo "${URL}"
EOF
```

- [ ] **Step 2: Make it executable**

```bash
ssh classify@172.16.30.85 'chmod +x ~/powersync-server/scripts/tunnel-url.sh'
```

- [ ] **Step 3: Verify the script runs (it will fail until cloudflared is up — that is expected)**

```bash
ssh classify@172.16.30.85 '~/powersync-server/scripts/tunnel-url.sh; echo "exit=$?"'
```

Expected: prints `No trycloudflare.com URL found in cloudflared logs.` to stderr and `exit=1`. This proves the script runs and the error path works. It will return a real URL after Task 4.

---

## Task 4: Bring up `cloudflared` and capture the URL

Start the new service, wait for the tunnel to register, and confirm `tunnel-url.sh` prints a working URL.

**Environment:** VM, inside `~/powersync-server/`.

- [ ] **Step 1: Start the service**

```bash
ssh classify@172.16.30.85 'cd ~/powersync-server && sudo docker compose up -d cloudflared'
```

Expected: `Container powersync-server-cloudflared-1 Started` (or similar). Exit 0.

- [ ] **Step 2: Wait briefly for the tunnel to register, then check logs**

```bash
ssh classify@172.16.30.85 'sleep 5 && cd ~/powersync-server && sudo docker compose logs --tail=40 cloudflared'
```

Expected: lines including `Registered tunnel connection` and a line of the form `Your quick Tunnel has been created! Visit it at:` followed by `https://<random-words>.trycloudflare.com`. If you see `connection refused` to `powersync:8080`, the powersync container is not up — bring it up with `sudo docker compose up -d powersync` and re-check.

- [ ] **Step 3: Capture the URL via the helper**

```bash
ssh classify@172.16.30.85 '~/powersync-server/scripts/tunnel-url.sh'
```

Expected: one line, e.g. `https://abcd-efgh-ijkl.trycloudflare.com`. Copy this value — Task 5 uses it.

- [ ] **Step 4: Sanity-check the URL with curl (from your laptop, not the VM)**

Replace `<TUNNEL_URL>` with the value from Step 3:

```bash
curl -sS -o /dev/null -w '%{http_code} %{ssl_verify_result}\n' <TUNNEL_URL>/probe
```

Expected: a `2xx`, `4xx`, or `404` status and `ssl_verify_result=0` (TLS verified — i.e. the cert is publicly trusted). A `4xx` or `404` is fine — that means PowerSync is reachable and rejecting the request at the app layer, which is the goal of this task. A `curl: (60)` cert error means something is wrong with the tunnel; do not proceed.

---

## Task 5: Update `client-mobile/.env`

Point the preview app at the new tunnel URL and fix the existing single-slash typo.

**Environment:** Local mac, working directory `client-mobile/`.

**Files:**
- Modify: `client-mobile/.env`

- [ ] **Step 1: Read the current value**

```bash
grep '^EXPO_PUBLIC_POWERSYNC_ENDPOINT=' .env
```

Expected: `EXPO_PUBLIC_POWERSYNC_ENDPOINT=https:/<current-tunnel>.trycloudflare.com` (note the single slash — that is the typo to fix).

- [ ] **Step 2: Replace the value with the real URL from Task 4 Step 3**

Open `.env` and replace the line with (substituting the actual URL):

```
EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://abcd-efgh-ijkl.trycloudflare.com
```

- [ ] **Step 3: Verify the value is a valid URL by running the zod-backed env check**

```bash
pnpm typecheck
```

Expected: PASS. (Typecheck imports `utils/env.ts` which calls `.url()` on `EXPO_PUBLIC_POWERSYNC_ENDPOINT` only when the runtime parses it, so this step really only catches TS errors — but it is the cheapest signal. The real URL validation happens at app start in Task 6.)

- [ ] **Step 4: No commit**

`.env` is gitignored (`.gitignore:34`). Leave it as a working-tree change only.

---

## Task 6: End-to-end verification on a preview build

Run the Expo preview app and confirm PowerSync connects through the tunnel with a trusted cert.

**Environment:** Mobile device (iOS or Android) running an Expo preview/dev build of `client-mobile`.

- [ ] **Step 1: Restart the Expo dev server so the new `.env` is picked up**

```bash
pnpm start --clear
```

Expected: Metro starts; previous cache is cleared (env vars are baked at build/start time for Expo).

- [ ] **Step 2: Reload the preview app on the device**

In the device app, fully close and reopen, or use the dev menu → Reload.

- [ ] **Step 3: Sign in and trigger a PowerSync connection**

Log in normally. Watch Metro logs for the PowerSync client. Expected: no TLS errors, no `NSURLErrorDomain -1202` (iOS untrusted cert), no `CertPathValidatorException` (Android). The first sync should complete and you should see classroom/courses data hydrate.

- [ ] **Step 4: Run `ForceSyncButton` (or pull-to-refresh) and confirm sync round-trips**

In-app, trigger a sync from `features/sync/components/ForceSyncButton.tsx` (or whichever screen exposes it). Expected: no errors in Metro logs; data updates.

- [ ] **Step 5: Cross-check from VM logs**

```bash
ssh classify@172.16.30.85 'cd ~/powersync-server && sudo docker compose logs --tail=30 powersync'
```

Expected: log lines showing the authenticated request from the device (JWT validated, sync stream opened). No `tls`/`certificate` errors.

If all five steps pass on both iOS and Android, the rollout is done.

---

## Rollback (if something fails)

1. **Stop the tunnel:** `ssh classify@172.16.30.85 'cd ~/powersync-server && sudo docker compose stop cloudflared'`
2. **Revert compose file (if needed):** `ssh classify@172.16.30.85 'cp ~/powersync-server/docker-compose.yml.bak.2026-05-22 ~/powersync-server/docker-compose.yml'`
3. **Revert `.env`:** restore the prior `EXPO_PUBLIC_POWERSYNC_ENDPOINT` value (e.g. the LAN `https://172.16.30.85` URL or the previous tunnel placeholder).
4. **Restart Expo:** `pnpm start --clear`.

PowerSync container and Caddy are untouched by this plan, so rollback has zero effect on the existing LAN sync path.
