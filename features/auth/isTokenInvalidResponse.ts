import { isStandardizedError } from "@/lib/api-error";

const TOKEN_ERROR_CODES = new Set(["token_not_valid", "not_authenticated"]);

/**
 * True when an axios error from the refresh endpoint indicates the
 * refresh token itself is server-side invalid (revoked, expired,
 * blacklisted), as opposed to an infrastructure 401/403 (WAF, proxy,
 * deploy hiccup).
 *
 * - 401 with no standardized body → token-invalid (legacy SimpleJWT
 *   shape; today's backend behavior).
 * - 401 or 403 with a `drf-standardized-errors` body carrying a
 *   token-error `code` → token-invalid.
 * - 403 without a token-error code → infrastructure; recoverable.
 */
export function isTokenInvalidResponse(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const response = (error as { response?: { status?: number; data?: unknown } })
    .response;
  if (!response || typeof response.status !== "number") return false;

  const { status, data } = response;
  if (status !== 401 && status !== 403) return false;

  if (isStandardizedError(data)) {
    return data.errors.some((e) => TOKEN_ERROR_CODES.has(e.code));
  }

  return status === 401;
}
