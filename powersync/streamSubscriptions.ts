import { jwtDecode } from "jwt-decode";
import type { SyncStreamSubscription } from "@powersync/react-native";
import { powersync } from "./db";

// Role → role-specific streams the client should subscribe to.
// Shared streams (user_identity, current_term_data, user_notifications,
// announcements_and_events) keep auto_subscribe: true in sync-rules.yaml
// and are NOT listed here — they sync for every authenticated user.
//
// Roles not present in this map (e.g. an unknown future role) receive
// zero role-specific streams, which matches today's AD/PH treatment.
const STREAMS_BY_ROLE: Record<string, readonly string[]> = {
  Student: [
    "student_enrolled_courses",
    "courses_and_schedule",
    "course_materials_and_assessments",
  ],
  Teacher: ["assigned_courses_for_teacher", "current_term_courses"],
  "Academic Director": [],
  "Program Head": [],
};

type PowerSyncJwtPayload = {
  role?: string;
};

const activeSubscriptions = new Map<string, SyncStreamSubscription>();

const decodeRole = (token: string | null | undefined): string | undefined => {
  if (!token) return undefined;
  try {
    return jwtDecode<PowerSyncJwtPayload>(token).role;
  } catch (err) {
    console.warn("[streamSubscriptions] failed to decode powersync token:", err);
    return undefined;
  }
};

// Idempotent: subscribes to the streams the role needs, unsubscribes from any
// previously-active subscription the new role no longer needs. Safe to call
// repeatedly (e.g. after every token refresh) — PowerSync deduplicates.
export const syncRoleStreams = async (
  token: string | null | undefined,
): Promise<void> => {
  const role = decodeRole(token);
  const wantedStreams: readonly string[] =
    (role && STREAMS_BY_ROLE[role]) || [];
  const wantedSet = new Set(wantedStreams);

  for (const [name, subscription] of activeSubscriptions) {
    if (!wantedSet.has(name)) {
      subscription.unsubscribe();
      activeSubscriptions.delete(name);
    }
  }

  await Promise.all(
    wantedStreams.map(async (name) => {
      if (activeSubscriptions.has(name)) return;
      try {
        const subscription = await powersync.syncStream(name).subscribe();
        activeSubscriptions.set(name, subscription);
      } catch (err) {
        console.warn(
          `[streamSubscriptions] failed to subscribe to "${name}":`,
          err,
        );
      }
    }),
  );
};

export const unsubscribeAllRoleStreams = (): void => {
  for (const [, subscription] of activeSubscriptions) {
    subscription.unsubscribe();
  }
  activeSubscriptions.clear();
};
