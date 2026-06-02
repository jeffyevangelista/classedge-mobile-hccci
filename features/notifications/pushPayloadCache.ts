// Process-local cache of push notification payloads, keyed by
// `${entityType}:${entityId}`. Populated by the OneSignal click
// handler before navigation; consumed by useEntityFromPushOrSync to
// hydrate detail screens on first paint while PowerSync catches up.
//
// Lifetime is intentionally per-process. Payloads outlive a single
// screen mount (so back/forward navigation within a session still
// hydrates) but not a process restart. The TTL guards against very
// stale payloads if the app was backgrounded a long time.

const TTL_MS = 5 * 60_000;

type Entry = {
  payload: unknown;
  ts: number;
};

const cache = new Map<string, Entry>();

// Some entity types are routed identically — e.g. "lesson" and "module"
// both land on the /material/[id] screen, and "activity" lands on the
// /assessment/[id] screen (see notifications.service.ts:getNotificationHref).
// Cache keys must follow the routing, so we normalize aliased types to
// their canonical name before constructing the key. Producers (the
// OneSignal click handler) and consumers (each detail screen) both go
// through this function, so they can't drift.
const ENTITY_TYPE_ALIASES: Record<string, string> = {
  lesson: "material",
  module: "material",
  activity: "assessment",
};

export const makeEntityKey = (
  entityType: string,
  entityId: string | number,
): string => {
  const canonical = ENTITY_TYPE_ALIASES[entityType] ?? entityType;
  return `${canonical}:${entityId}`;
};

export const setPushPayload = (key: string, payload: unknown): void => {
  cache.set(key, { payload, ts: Date.now() });
};

export const peekPushPayload = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Cast is intentional: callers nominate T to match the stored payload
  // shape (which originates from OneSignal additionalData and is unknown
  // at the type system level). If the payload shape diverges from T,
  // the canonical PowerSync row will override it on the next render.
  return entry.payload as T;
};

export const clearPushPayload = (key: string): void => {
  cache.delete(key);
};
