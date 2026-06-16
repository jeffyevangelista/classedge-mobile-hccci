import { createMMKV } from "react-native-mmkv";
import type { PendingEvent } from "./types";

const KEY_PREFIX = "evt:";
const MAX_QUEUE_SIZE = 5000;
const EVICT_BATCH = 100;

const storage = createMMKV({ id: "activity-events" });

let droppedSinceLaunch = 0;

export function enqueue(event: PendingEvent): void {
  if (size() >= MAX_QUEUE_SIZE) {
    evictOldest();
  }
  storage.set(KEY_PREFIX + event.client_event_id, JSON.stringify(event));
}

export function size(): number {
  return storage.getAllKeys().filter((k) => k.startsWith(KEY_PREFIX)).length;
}

export function readBatch(maxN: number): PendingEvent[] {
  const keys = storage
    .getAllKeys()
    .filter((k) => k.startsWith(KEY_PREFIX))
    .sort()
    .slice(0, maxN);

  const events: PendingEvent[] = [];
  for (const key of keys) {
    const raw = storage.getString(key);
    if (!raw) continue;
    try {
      events.push(JSON.parse(raw) as PendingEvent);
    } catch {
      storage.remove(key);
    }
  }
  return events;
}

export function deleteByClientEventIds(ids: string[]): void {
  for (const id of ids) {
    storage.remove(KEY_PREFIX + id);
  }
}

function evictOldest(): void {
  const keys = storage
    .getAllKeys()
    .filter((k) => k.startsWith(KEY_PREFIX))
    .sort()
    .slice(0, EVICT_BATCH);
  for (const k of keys) storage.remove(k);
  droppedSinceLaunch += keys.length;
}

export function getDroppedSinceLaunch(): number {
  return droppedSinceLaunch;
}

/**
 * Drop every queued event. Called on sign-out (after the final flush
 * attempt) so events authored under the previous JWT are never sent
 * under a different user's session.
 */
export function dropQueue(): void {
  for (const k of storage.getAllKeys()) storage.remove(k);
  droppedSinceLaunch = 0;
}
