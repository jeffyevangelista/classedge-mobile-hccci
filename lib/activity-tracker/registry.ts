import type { ActivityAction, EmitIds } from "./types";

type RegistryEntry = {
  action: ActivityAction;
  extract: (params: Record<string, string | undefined>) => EmitIds;
};

const asNumber = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Pathname → audit action mapper. Keys use expo-router's bracket syntax:
 * a literal `[paramName]` segment matches any value and exposes it to
 * `extract(...)` under `params[paramName]`. Group dirs `(...)` are not
 * part of the runtime path.
 *
 * Routes not in this map produce no auto-emit.
 */
export const screenRegistry: Record<string, RegistryEntry> = {
  "/subject/[subjectId]/subject-details": {
    action: "open_subject",
    extract: (p) => ({ subjectId: asNumber(p.subjectId) }),
  },
  "/course/[courseId]": {
    action: "open_subject",
    extract: (p) => ({ subjectId: asNumber(p.courseId) }),
  },
  "/course/[courseId]/course-details": {
    action: "open_subject",
    extract: (p) => ({ subjectId: asNumber(p.courseId) }),
  },
  "/activity/[activityId]": {
    action: "open_activity",
    extract: (p) => ({ activityId: p.activityId }),
  },
  "/assessment/[assessmentId]": {
    action: "open_activity",
    extract: (p) => ({ activityId: p.assessmentId }),
  },
  "/lesson/[lessonId]": {
    action: "open_lesson",
    extract: (p) => ({ moduleId: asNumber(p.lessonId) }),
  },
  "/material/[materialId]": {
    action: "open_lesson",
    extract: (p) => ({ moduleId: asNumber(p.materialId) }),
  },
  "/announcement/[announcementId]": {
    action: "open_announcement",
    extract: (p) => ({
      entityType: "announcement",
      entityId: p.announcementId,
    }),
  },
  "/event/[eventId]": {
    action: "open_calendar_event",
    extract: (p) => ({
      entityType: "calendar_event",
      entityId: p.eventId,
    }),
  },
  "/attempt/[attemptId]/review": {
    action: "view_score",
    extract: (p) => ({ activityId: p.attemptId }),
  },
  "/profile": {
    action: "open_profile",
    extract: () => ({}),
  },
};

/**
 * Match a resolved pathname against the registry and extract the bracket
 * segments as params (independent of `useLocalSearchParams`, which only
 * works inside the route component). Returns `null` if no match.
 */
export function matchPath(
  pathname: string,
): { entry: RegistryEntry; templatedPath: string; params: Record<string, string> } | null {
  for (const key of Object.keys(screenRegistry)) {
    const params = paramsForTemplate(pathname, key);
    if (params !== null) {
      return { entry: screenRegistry[key], templatedPath: key, params };
    }
  }
  return null;
}

function paramsForTemplate(
  actual: string,
  template: string,
): Record<string, string> | null {
  const a = actual.split("/").filter(Boolean);
  const t = template.split("/").filter(Boolean);
  if (a.length !== t.length) return null;
  const extracted: Record<string, string> = {};
  for (let i = 0; i < t.length; i += 1) {
    const seg = t[i];
    if (seg.startsWith("[") && seg.endsWith("]")) {
      const paramName = seg.slice(1, -1);
      extracted[paramName] = a[i];
    } else if (seg !== a[i]) {
      return null;
    }
  }
  return extracted;
}
