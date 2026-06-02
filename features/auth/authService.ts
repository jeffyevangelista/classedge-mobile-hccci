// features/auth/authService.ts
//
// Centralized Microsoft OAuth lifecycle owner. All OAuth completion logic
// lives here so it doesn't depend on any component being mounted.
//
// Each login attempt generates a unique flowId (UUID), passed to Microsoft
// as the OAuth `state` parameter. The PKCE codeVerifier is keyed by flowId
// in MMKV. When the redirect arrives, we look up the verifier by the
// round-tripped state. Stale URLs (no matching verifier entry) are silently
// ignored. The deep link arrives via both Linking.addEventListener
// (cold-start) and the callback.tsx route (warm-app) — both converge on
// handleCallbackUrl, which is idempotent.

import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import useStore from "@/lib/store";
import { env } from "@/utils/env";
import { captureAuthError, captureAuthMessage } from "@/lib/telemetry";
import { msLogin } from "./auth.apis";
import { hydrateSession } from "./hydrateSession";
import {
  deleteVerifier,
  getVerifier,
  pruneExpired,
  saveVerifier,
} from "./oauthVerifierStore";

const SCOPES = ["api://183431e3-ef34-43eb-8dbe-c4e4b7da7786/read"];
const REDIRECT_PATH = "auth/callback";

// Module-level idempotency state. Cleared by cancelOAuth.
let lastProcessedCode: string | null = null;
let inFlightExchange: Promise<void> | null = null;

const getDiscoveryUrl = () =>
  `https://login.microsoftonline.com/${env.EXPO_PUBLIC_MICROSOFT_TENANT_ID}/v2.0`;

const getRedirectUri = () =>
  AuthSession.makeRedirectUri({ path: REDIRECT_PATH });

/**
 * Entry point invoked by MSAuthButton. Generates a flowId, prunes expired
 * verifier entries, builds the AuthRequest with `state: flowId`, persists
 * the PKCE codeVerifier keyed by flowId, opens the browser, and on warm-app
 * return delegates to handleCallbackUrl.
 *
 * Errors are surfaced via toast at the call site; this throws after telemetry
 * + state cleanup.
 */
export async function startMicrosoftLogin(): Promise<void> {
  const { setOAuthPhase } = useStore.getState();
  let reachedHandleCallback = false;

  try {
    pruneExpired();

    const flowId = Crypto.randomUUID();
    const startedAt = Date.now();
    setOAuthPhase({ phase: "opening_browser", startedAt });

    const discovery = await AuthSession.fetchDiscoveryAsync(getDiscoveryUrl());
    const redirectUri = getRedirectUri();

    const request = new AuthSession.AuthRequest({
      clientId: env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      state: flowId,
      extraParams: { prompt: "select_account" },
    });

    await request.makeAuthUrlAsync(discovery);

    if (!request.codeVerifier) {
      throw new Error("Failed to generate PKCE codeVerifier");
    }

    saveVerifier(flowId, request.codeVerifier);

    setOAuthPhase({ phase: "awaiting_user", startedAt });
    captureAuthMessage("oauth_started");

    const result = await request.promptAsync(discovery);

    if (result.type === "success" && result.params?.code) {
      const callbackUrl =
        result.url ??
        `${redirectUri}?code=${result.params.code}&state=${flowId}`;
      reachedHandleCallback = true;
      await handleCallbackUrl(callbackUrl);
    } else if (result.type === "cancel" || result.type === "dismiss") {
      cancelOAuth();
    } else if (result.type === "error") {
      captureAuthError(
        "ms_token_exchange_failed",
        new Error(result.errorCode ?? "unknown_oauth_error"),
      );
      cancelOAuth();
      reachedHandleCallback = true;
      throw new Error(result.errorCode ?? "OAuth error");
    }
  } catch (error) {
    if (!reachedHandleCallback) {
      captureAuthError("ms_token_exchange_failed", error);
      cancelOAuth();
    }
    throw error;
  }
}

/**
 * Completes OAuth given a redirect URL containing `?code=…&state=…`. Called
 * by both the Linking listener (cold-start path) and the callback.tsx route
 * (warm-app path). Idempotent: same URL twice = single exchange.
 *
 * Silent returns:
 *   - No code in URL → stray deep link, ignore.
 *   - Same code as last processed → already handled, ignore.
 *   - No state in URL → malformed, can't correlate, ignore.
 *   - No verifier entry for this state → stale URL replay, emit info-level
 *     telemetry and ignore (no error UI).
 */
export async function handleCallbackUrl(url: string): Promise<void> {
  if (inFlightExchange) return inFlightExchange;

  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code as string | undefined;
  const state = parsed.queryParams?.state as string | undefined;

  if (!code) return;
  if (code === lastProcessedCode) return;
  if (!state) {
    captureAuthMessage("oauth_stale_url_ignored", { reason: "no_state" });
    return;
  }

  const codeVerifier = getVerifier(state);
  if (!codeVerifier) {
    captureAuthMessage("oauth_stale_url_ignored", {
      reason: "verifier_not_found",
    });
    return;
  }

  inFlightExchange = (async () => {
    try {
      lastProcessedCode = code;
      const { setOAuthPhase, oauthStartedAt } = useStore.getState();
      const startedAt = oauthStartedAt ?? Date.now();

      setOAuthPhase({ phase: "exchanging_code", startedAt });

      const discovery = await AuthSession.fetchDiscoveryAsync(
        getDiscoveryUrl(),
      );
      const redirectUri = getRedirectUri();

      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: codeVerifier },
        },
        discovery,
      );

      if (!tokenResult.accessToken) {
        throw new Error("MS token exchange returned no accessToken");
      }

      setOAuthPhase({ phase: "exchanging_session", startedAt });

      const data = await msLogin(tokenResult.accessToken);
      await hydrateSession(data);

      // Success — clear THIS flow's verifier (others stay until TTL).
      deleteVerifier(state);
      setOAuthPhase({ phase: "idle", startedAt: null });
    } catch (error) {
      // NOTE: we don't delete the verifier here. Keep it so the user (or
      // another fire of the same URL within MS's code window) could retry.
      // The orphan will be pruned on next startMicrosoftLogin.
      captureAuthError("ms_token_exchange_failed", error);
      cancelOAuth();
      throw error;
    } finally {
      inFlightExchange = null;
    }
  })();

  return inFlightExchange;
}

/**
 * Reset OAuth state — called on cancel, error, timeout. Resets UI phase and
 * idempotency state, but does NOT delete verifier entries (those live until
 * TTL or success). Pruning is centralized in startMicrosoftLogin.
 */
export function cancelOAuth(): void {
  const { setOAuthPhase } = useStore.getState();
  setOAuthPhase({ phase: "idle", startedAt: null });
  lastProcessedCode = null;
  inFlightExchange = null;
}
