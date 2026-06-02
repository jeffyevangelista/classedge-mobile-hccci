import * as Sentry from "@sentry/react-native";
import { env } from "@/utils/env";

/**
 * Initialise Sentry once at app startup. Safe no-op when no DSN is configured
 * (e.g. local dev without a Sentry account) — capture calls elsewhere just
 * become drops.
 */
export function initTelemetry(): void {
  if (!env.EXPO_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: env.EXPO_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

export type TelemetryEvent =
  // auth flow
  | "ms_token_exchange_failed"
  | "silent_refresh_failed"
  | "forced_logout"
  | "account_switch_detected"
  // oauth lifecycle
  | "oauth_started"
  | "oauth_phase_timeout"
  | "oauth_cold_start_recovery"
  | "oauth_stale_url_ignored"
  // section rendering
  | "section_loading_slow"
  | "section_offline_empty"
  | "post_login_ready";

// Backwards-compat alias for existing call sites — TelemetryEvent is a superset.
export type AuthEvent = TelemetryEvent;

/**
 * Report a telemetry-worthy error (auth failure, section render fault, etc.).
 * Tagged so Sentry can group/filter by event type.
 */
export function captureAuthError(
  event: TelemetryEvent,
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  Sentry.captureException(error, {
    tags: { event },
    extra: extras,
  });
}

/**
 * Report a non-error telemetry signal (account switch, slow section, etc.).
 * Surfaced as a message so it shows up in Sentry without being treated as an
 * exception.
 */
export function captureAuthMessage(
  event: TelemetryEvent,
  extras?: Record<string, unknown>,
): void {
  Sentry.captureMessage(event, {
    level: "info",
    tags: { event },
    extra: extras,
  });
}

// --- Post-login readiness tracking ---

let loginReadyArmed = false;
let loginAuthenticatedAt: number | null = null;

/**
 * Call when `isAuthenticated` flips to true. Arms the post-login timer so the
 * NEXT `markPostLoginReady()` call records the elapsed time. Idempotent — calling
 * again before `markPostLoginReady` fires resets the timer.
 */
export function armPostLoginReady(): void {
  loginReadyArmed = true;
  loginAuthenticatedAt = Date.now();
}

/**
 * Call once a section finishes its first non-loading render after login. Fires
 * a one-shot `post_login_ready` Sentry event with elapsed ms. No-op if not
 * armed or already fired.
 */
export function markPostLoginReady(): void {
  if (!loginReadyArmed || loginAuthenticatedAt === null) return;
  const elapsedMs = Date.now() - loginAuthenticatedAt;
  loginReadyArmed = false;
  loginAuthenticatedAt = null;
  captureAuthMessage("post_login_ready", { elapsedMs });
}
