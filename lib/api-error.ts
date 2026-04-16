import type { AxiosError } from "axios";

// ---------------------------------------------------------------------------
// drf-standardized-errors response shape
// ---------------------------------------------------------------------------

export type ErrorType = "validation_error" | "client_error" | "server_error";

export interface StandardizedErrorItem {
  code: string;
  detail: string;
  attr: string | null;
}

export interface StandardizedErrorResponse {
  type: ErrorType;
  errors: StandardizedErrorItem[];
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  type: ErrorType;
  errors: StandardizedErrorItem[];

  constructor(body: StandardizedErrorResponse, status?: number) {
    const message = summarizeErrors(body);
    super(message);
    this.name = "ApiError";
    this.type = body.type;
    this.errors = body.errors;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a single human-readable message from the standardized error body.
 *
 * - For non-field errors (attr === null) the detail is used directly.
 * - For field errors the attr name is prepended for clarity.
 * - Multiple errors are joined with newlines.
 */
function summarizeErrors(body: StandardizedErrorResponse): string {
  if (!body.errors?.length) return "An unexpected error occurred.";

  return body.errors
    .map((e) => (e.attr ? `${e.attr}: ${e.detail}` : e.detail))
    .join("\n");
}

/**
 * Return a map of field name → list of error details (useful for forms).
 */
export function getFieldErrors(
  error: unknown,
): Record<string, string[]> | null {
  if (!(error instanceof ApiError)) return null;
  if (error.type !== "validation_error") return null;

  const map: Record<string, string[]> = {};
  for (const e of error.errors) {
    const key = e.attr ?? "non_field_errors";
    (map[key] ??= []).push(e.detail);
  }
  return map;
}

/**
 * Safely extract a display-friendly error message from any thrown value.
 *
 * Prefers:
 *   1. ApiError.message  (already formatted by summarizeErrors)
 *   2. Axios response body fallback
 *   3. Generic Error.message
 *   4. Static fallback string
 */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

/**
 * Type-guard: returns true when the response body looks like a
 * drf-standardized-errors payload.
 */
export function isStandardizedError(
  data: unknown,
): data is StandardizedErrorResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.type === "string" &&
    Array.isArray(d.errors) &&
    d.errors.every(
      (e: any) =>
        typeof e.code === "string" &&
        typeof e.detail === "string" &&
        (e.attr === null || typeof e.attr === "string"),
    )
  );
}
