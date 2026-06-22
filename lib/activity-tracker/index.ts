import { createId } from "@paralleldrive/cuid2";
import { AppState, type AppStateStatus } from "react-native";
import { flush } from "./flush";
import { enqueue, size } from "./queue";
import type { ActivityAction, EmitIds, PendingEvent } from "./types";

const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_THRESHOLD = 20;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;

export function track(
  action: ActivityAction,
  ids?: EmitIds,
  description?: string,
): void {
  const event: PendingEvent = {
    client_event_id: createId(),
    action,
    subject_id: ids?.subjectId ?? null,
    activity_id: ids?.activityId ?? null,
    module_id: ids?.moduleId ?? null,
    entity_type: ids?.entityType ?? null,
    entity_id: ids?.entityId ?? null,
    description,
    occurred_at: new Date().toISOString(),
  };
  enqueue(event);

  if (size() >= FLUSH_THRESHOLD) {
    void flush();
  }
}

export { flush };

export function startActivityTracker(): () => void {
  if (intervalHandle === null) {
    intervalHandle = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);
  }
  if (appStateSub === null) {
    const handler = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        void flush();
      }
    };
    appStateSub = AppState.addEventListener("change", handler);
  }
  return stopActivityTracker;
}

export function stopActivityTracker(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (appStateSub !== null) {
    appStateSub.remove();
    appStateSub = null;
  }
}

export type { ActivityAction, EmitIds };
