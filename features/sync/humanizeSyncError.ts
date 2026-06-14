import { AttachmentFetchError } from "@/features/attachments/attachments.fetcher";
import { UploadOpError } from "@/powersync/Connector";

export type HumanizedSyncError = {
  /** One sentence the user can read at a glance. */
  message: string;
  /** Optional next-action hint. */
  hint?: string;
};

type StatusLike = { status?: number | null };

const hasStatus = (err: unknown): err is StatusLike =>
  typeof err === "object" && err !== null && "status" in err;

const isNetworkError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("enotfound") ||
    m.includes("offline")
  );
};

const isOutOfSpace = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("enospc") || m.includes("no space");
};

/**
 * Translate any sync-path error into a user-facing message and optional hint.
 * The original error is NOT discarded — it stays in `sync_events_local` and
 * in console logs for diagnostics.
 */
export function humanizeSyncError(err: unknown): HumanizedSyncError {
  if (isOutOfSpace(err)) {
    return {
      message: "Your device is low on space.",
      hint: "Free up some storage to download new files.",
    };
  }

  if (isNetworkError(err)) {
    return {
      message: "You're offline. Your work is saved on this device.",
      hint: "We'll send it when you reconnect.",
    };
  }

  const status =
    err instanceof UploadOpError
      ? err.status
      : err instanceof AttachmentFetchError
        ? err.status
        : hasStatus(err)
          ? (err.status ?? null)
          : null;

  if (status === 401) {
    return {
      message: "Your session needs to be renewed.",
      hint: "Sign out and back in if this keeps happening.",
    };
  }
  if (status === 403) {
    return {
      message: "You don't have permission to do this.",
      hint: "Contact your school admin if you think this is a mistake.",
    };
  }
  if (status === 404) {
    if (err instanceof AttachmentFetchError) {
      return { message: "This file is no longer available on the server." };
    }
    return {
      message:
        "The record we're trying to update no longer exists on the server.",
    };
  }
  if (status === 413) {
    return {
      message: "This upload is too large.",
      hint: "Try removing or resizing the file.",
    };
  }
  if (status === 400 || status === 422) {
    return {
      message: "The server didn't accept this update.",
      hint: "Try again, or contact support if it keeps happening.",
    };
  }
  if (status !== null && status >= 500) {
    return {
      message: "The server is having trouble right now.",
      hint: "We'll keep retrying automatically.",
    };
  }

  return {
    message: "Something went wrong syncing this.",
    hint: "Tap Retry, or check the Events tab for details.",
  };
}
