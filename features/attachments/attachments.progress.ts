// In-memory progress store for in-flight attachment downloads.
// Intentionally NOT persisted to SQLite — write-per-chunk would
// dwarf the cost of the download itself, and the value is meaningless
// after `state` transitions to SYNCED. The store is reset on app
// restart, which is fine because the fetcher doesn't resume partial
// downloads anyway.
//
// Notifications are throttled per id so a chatty fetcher progress
// stream produces at most ~10 re-renders/second per attachment.

export type AttachmentProgress = {
  downloaded: number;
  /** -1 when the server didn't send Content-Length (chunked encoding). */
  total: number;
  /** -1 when total is unknown; consumers should render indeterminate. */
  fraction: number;
};

const NOTIFY_THROTTLE_MS = 100;

const store = new Map<string, AttachmentProgress>();
const listeners = new Map<string, Set<() => void>>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function flush(id: string): void {
  pending.delete(id);
  const set = listeners.get(id);
  if (!set) return;
  for (const cb of set) cb();
}

export function setAttachmentProgress(
  id: string,
  downloaded: number,
  total: number,
): void {
  const fraction = total > 0 ? Math.min(1, downloaded / total) : -1;
  const existing = store.get(id);
  if (
    existing &&
    existing.downloaded === downloaded &&
    existing.total === total
  ) {
    return;
  }
  store.set(id, { downloaded, total, fraction });

  if (pending.has(id)) return;
  pending.set(
    id,
    setTimeout(() => flush(id), NOTIFY_THROTTLE_MS),
  );
}

export function clearAttachmentProgress(id: string): void {
  const hadEntry = store.delete(id);
  const timer = pending.get(id);
  if (timer) {
    clearTimeout(timer);
    pending.delete(id);
  }
  if (hadEntry) flush(id);
}

export function clearAllAttachmentProgress(): void {
  const ids = Array.from(store.keys());
  store.clear();
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
  for (const id of ids) flush(id);
}

export function getAttachmentProgress(
  id: string,
): AttachmentProgress | undefined {
  return store.get(id);
}

export function subscribeAttachmentProgress(
  id: string,
  listener: () => void,
): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(listener);
  return () => {
    const s = listeners.get(id);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listeners.delete(id);
  };
}
