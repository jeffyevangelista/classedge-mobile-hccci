# PowerSync Public Trusted Cert via TryCloudflare

**Date:** 2026-05-22
**Scope:** Local e2e / preview-app testing only. Not a production deployment design.

## Background

Self-hosted PowerSync runs in `~/powersync-server/` on the VM `classify@172.16.30.85`, currently fronted by Caddy with a self-signed cert from Caddy's local CA. To use the server from iOS/Android preview apps without distributing a custom root CA, we need a publicly trusted TLS cert in front of PowerSync.

Constraints discovered during brainstorming:

- The VM is **not reachable from the public internet** (no inbound 80/443).
- The DNS zone for `classify.com.ph` is at a registrar with **no API access** and the user does not want to repoint nameservers.
- The goal is **e2e / preview-app testing**, not production — so an ephemeral URL is acceptable.

## Decision

Use **TryCloudflare** (Cloudflare's anonymous quick-tunnel mode) to expose the existing PowerSync container at `https://<random>.trycloudflare.com` with a trusted edge cert. No DNS zone, no Cloudflare account, no domain required.

Stable-URL alternatives (Cloudflare Tunnel with a managed hostname, Tailscale Funnel) were considered and rejected for this scope — they require either a CF-managed DNS zone or a tailnet, neither of which is justified for ephemeral preview testing.

## Architecture

```
[iOS/Android preview app]
        │  HTTPS (trusted cert from CF edge)
        ▼
[Cloudflare edge]   https://<random>.trycloudflare.com
        │  HTTP/2 tunnel (outbound from VM, no inbound ports)
        ▼
[cloudflared container on VM]
        │  HTTP via docker network
        ▼
[powersync container :8080]
```

- `cloudflared` runs alongside `powersync` in the existing compose stack and connects out to Cloudflare; no inbound firewall changes on the VM.
- Auth is unchanged: PowerSync JWT (RS256 via JWKS at `https://testmobile.classify.com.ph/api/powersync/jwks/`, audience `powersync-classedge`) still gates every request. The tunnel is transport, not auth.
- Caddy stays in place but is unused by mobile preview clients. It remains available for any LAN tooling that hits `172.16.30.85` directly. No removal is in scope.

## Components & files

### On the VM (`~/powersync-server/`)

1. **`docker-compose.yml`** — add a `cloudflared` service as a sibling of `powersync`:

   ```yaml
   cloudflared:
     image: cloudflare/cloudflared:latest
     restart: unless-stopped
     command: tunnel --no-autoupdate --url http://powersync:8080
     depends_on:
       - powersync
   ```

   No volumes, no config file, no credentials — pure anonymous quick tunnel.

2. **`scripts/tunnel-url.sh`** — small helper that greps `docker compose logs cloudflared` for the current `https://*.trycloudflare.com` line and prints it. Used after each `docker compose up` to grab the fresh URL for the mobile `.env`.

### In `client-mobile/`

3. **`.env`** — set `EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://<current-tunnel>.trycloudflare.com` each session. Note: the current value in `.env` has a typo (single slash after `https:`) which will fail the zod `.url()` validation at `utils/env.ts:9` — fix as part of this change.

4. **No code changes.** The endpoint is already env-driven: validated at `client-mobile/utils/env.ts:7-9` and consumed at `client-mobile/powersync/Connector.ts:115`.

## Workflow (per test session)

```
1. SSH to VM, cd ~/powersync-server
2. docker compose up -d cloudflared
3. ./scripts/tunnel-url.sh
     → https://abcd-efgh-ijkl.trycloudflare.com
4. Paste into client-mobile/.env:
     EXPO_PUBLIC_POWERSYNC_ENDPOINT=https://abcd-efgh-ijkl.trycloudflare.com
5. Reload Expo preview app → PowerSync connects over trusted TLS
```

## Error handling & rollback

- **`cloudflared` fails to start** (e.g. VM egress blocked): `docker compose logs cloudflared` shows the reason. The Caddy + LAN IP path remains intact, so the local dev flow is unaffected.
- **Tunnel URL rotates unexpectedly mid-session:** detected as a sudden PowerSync connection error in the app — re-run step 3 of the workflow and reload the app.
- **Rollback:** `docker compose stop cloudflared` and revert `.env` to the prior value (LAN IP or commented-out tunnel). Zero impact on the `powersync` container itself.

## Out of scope

- Stable custom-domain hostname (would require a Cloudflare-managed DNS zone for `classify.com.ph` or NS-delegation of a subdomain — explicitly deferred).
- Removing Caddy, retiring the `default_sni 172.16.30.85` workaround, or cleaning up the locally-distributed CA root cert.
- Production deployment path. This design targets e2e / preview-app testing only.
- Cloudflare Access policies, IP allowlisting, or rate limits in front of the tunnel — JWT auth at the PowerSync layer is considered sufficient for testing.

## Success criteria

- iOS and Android preview apps connect to PowerSync over `https://*.trycloudflare.com` without a custom CA installed and without TLS warnings.
- `docker compose up -d cloudflared` on the VM brings the tunnel up and `scripts/tunnel-url.sh` returns the current URL.
- Reverting the change is a single `docker compose stop cloudflared` plus an `.env` edit, with no residual changes to the `powersync` container.
