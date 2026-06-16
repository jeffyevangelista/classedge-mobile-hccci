import type { ActivityAction, EmitIds } from "./types";

type RegistryEntry = {
  action: ActivityAction;
  extract: (params: Record<string, string | string[] | undefined>) => EmitIds;
};

const asString = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const asNumber = (v: string | string[] | undefined): number | undefined => {
  const s = asString(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Pathname → audit action mapper. Keys use expo-router's bracket syntax:
 * a literal `[paramName]` segment matches any value and exposes it under
 * `params[paramName]`. Group dirs `(...)` are not part of the runtime path.
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
    extract: (p) => ({ activityId: asString(p.activityId) }),
  },
  "/assessment/[assessmentId]": {
    action: "open_activity",
    extract: (p) => ({ activityId: asString(p.assessmentId) }),
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
      entityId: asString(p.announcementId),
    }),
  },
  "/event/[eventId]": {
    action: "open_calendar_event",
    extract: (p) => ({
      entityType: "calendar_event",
      entityId: asString(p.eventId),
    }),
  },
  "/attempt/[attemptId]/review": {
    action: "view_score",
    extract: (p) => ({ activityId: asString(p.attemptId) }),
  },
  "/profile": {
    action: "open_profile",
    extract: () => ({}),
  },
};

/**
 * Match a resolved pathname (e.g. "/subject/42/subject-details") to a
 * registry entry by replacing concrete segments with their bracketed
 * template form. Returns `null` if no match.
 */
export function matchPath(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
): { entry: RegistryEntry; templatedPath: string } | null {
  for (const key of Object.keys(screenRegistry)) {
    if (pathMatchesTemplate(pathname, key, params)) {
      return { entry: screenRegistry[key], templatedPath: key };
    }
  }
  return null;
}

function pathMatchesTemplate(
  actual: string,
  template: string,
  params: Record<string, string | string[] | undefined>,
): boolean {
  const a = actual.split("/").filter(Boolean);
  const t = template.split("/").filter(Boolean);
  if (a.length !== t.length) return false;
  for (let i = 0; i < t.length; i += 1) {
    const seg = t[i];
    if (seg.startsWith("[") && seg.endsWith("]")) {
      const paramName = seg.slice(1, -1);
      const paramVal = asString(params[paramName]);
      if (paramVal !== a[i]) return false;
    } else if (seg !== a[i]) {
      return false;
    }
  }
  return true;
}
