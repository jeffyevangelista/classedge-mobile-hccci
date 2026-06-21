import useStore from "@/lib/store";
import { useQuery } from "@powersync/tanstack-react-query";
import { useQuery as usePowerSyncQuery } from "@powersync/react-native";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useEffect, useMemo, useState } from "react";
import {
  getCourseAssessment,
  getCourseDetails,
  getCourseMaterial,
  getStudentCourses,
  getTeacherSubjectDetails,
} from "./courses.service";
import { getCourseStudentsApi, getPendingAssessments } from "./courses.apis";
import {
  keepPreviousData,
  useQuery as useApiQuery,
} from "@tanstack/react-query";

// Watch-backed enrolled-course list. When studentId is 0 (no auth yet)
// the SQL returns an empty result, so the WHERE filter naturally gates
// it without needing TanStack's `enabled`.
export const useStudentCourses = () => {
  const authUser = useStore((state) => state.authUser);
  const studentId = authUser?.id ?? 0;

  const { data: rows, isLoading, isFetching, error, refresh } = usePowerSyncQuery(
    toCompilableQuery(getStudentCourses(studentId)),
  );

  const data = useMemo(
    () =>
      (rows ?? []).filter(
        (e) =>
          e.subjectId !== null &&
          !e.subjectId.isCte &&
          !e.subjectId.isHali &&
          !e.subjectId.isCoil,
      ),
    [rows],
  );

  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed: re-runs automatically whenever any of the underlying
// tables (course_subjectenrollment, module_module, activity_activity,
// activity_studentactivity, activity_retakerecord) get new rows from
// PowerSync replication. The CTE resolves enrollment → subjectId in a
// single round trip so the watch covers enrollment changes too.
export const useCourseTimeline = (courseId: string) => {
  const authUser = useStore((state) => state.authUser);
  const studentId = authUser?.id ?? 0;

  return useQuery({
    queryKey: ["course_timeline", courseId, authUser?.id],
    query: `
      WITH enrollment AS (
        SELECT subject_id FROM course_subjectenrollment WHERE id = ?
      )
      SELECT
        CAST(m.id AS TEXT) AS id,
        m.file_name      AS fileName,
        m.start_date     AS startDate,
        'material'       AS type,
        0 AS showScore,
        0 AS maxScore,
        0 AS classroomMode,
        0 AS hasSubmission,
        0 AS totalScore
      FROM module_module m
      WHERE m.subject_id = (SELECT subject_id FROM enrollment)
      UNION ALL
      SELECT
        a.id             AS id,
        a.activity_name  AS fileName,
        a.end_time       AS startDate,
        'assessment'     AS type,
        CASE WHEN a.show_score      THEN 1 ELSE 0 END AS showScore,
        a.max_score                                   AS maxScore,
        CASE WHEN a.classroom_mode  THEN 1 ELSE 0 END AS classroomMode,
        CASE
          WHEN a.classroom_mode AND sa.id IS NOT NULL THEN 1
          WHEN r.submitted_cnt > 0 THEN 1
          ELSE 0
        END AS hasSubmission,
        CASE
          WHEN a.classroom_mode AND sa.id IS NOT NULL THEN COALESCE(sa.total_score, 0)
          WHEN r.submitted_cnt > 0 THEN COALESCE(sa.total_score, 0)
          ELSE 0
        END AS totalScore
      FROM activity_activity a
      LEFT JOIN activity_studentactivity sa
        ON sa.activity_id = a.id AND sa.student_id = ?
      LEFT JOIN (
        SELECT student_activity_id, COUNT(*) AS submitted_cnt
        FROM activity_retakerecord
        WHERE status = 'submitted'
        GROUP BY student_activity_id
      ) r ON r.student_activity_id = sa.id
      WHERE a.subject_id = (SELECT subject_id FROM enrollment)
      ORDER BY startDate DESC
    `,
    parameters: [Number(courseId), studentId],
  });
};

// Watch-backed single material row. Re-fires when the material is
// edited server-side and replicated locally (teacher updates the file,
// description, dates, etc.).
export const useCourseMaterial = (materialId: string) => {
  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(toCompilableQuery(getCourseMaterial(materialId)));
  const data = useMemo(() => rows?.[0] ?? null, [rows]);
  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed course details (single enrollment row + nested subject +
// schedules). Watches react to changes in course_subjectenrollment,
// subject_subject, accounts_profile (teacher), and subject_schedule.
export const useCourseDetails = (courseId: string) => {
  const { data: rows, isLoading, isFetching, error, refresh } = usePowerSyncQuery(
    toCompilableQuery(getCourseDetails(courseId)),
  );

  const data = useMemo(() => rows?.[0] ?? null, [rows]);

  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Teacher-side analogue of useCourseDetails. The URL `classroomId` here is
// a subject id (TeachingCourseList links straight to /classroom/<subject.id>),
// so we look it up against the subjects table and reshape the row to match
// the `{ subjectId, schedules }` shape the student hook returns. This lets
// CourseDetails render the same UI without role-specific branching below
// the data layer.
export const useTeacherCourseDetails = (subjectId: string) => {
  const { data: rows, isLoading, isFetching, error, refresh } = usePowerSyncQuery(
    toCompilableQuery(getTeacherSubjectDetails(subjectId)),
  );

  const data = useMemo(() => {
    const subject = rows?.[0];
    if (!subject) return null;
    const { schedules, ...subjectFields } = subject;
    return {
      subjectId: subjectFields,
      schedules: schedules ?? [],
    };
  }, [rows]);

  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

export const useCourseStudents = (subjectId: number | undefined) => {
  return useApiQuery({
    queryKey: ["course-students", subjectId],
    enabled: !!subjectId,
    queryFn: () => getCourseStudentsApi(subjectId!),
  });
};

export const usePendingAssessments = (subjectId: string | null) => {
  return useQuery({
    queryKey: ["pending-assessments", subjectId],
    queryFn: () => getPendingAssessments({ subjectId }),
    placeholderData: keepPreviousData,
  });
};

// Watch-backed single assessment row. Re-fires when the assessment is
// edited server-side and replicated locally (e.g. teacher updates
// instructions, due date, max score).
export const useCourseAssessment = (assessmentId: string) => {
  const { data: rows, isLoading, isFetching, error, refresh } = usePowerSyncQuery(
    toCompilableQuery(getCourseAssessment(assessmentId)),
  );

  const data = useMemo(() => rows?.[0] ?? null, [rows]);

  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

export type CoursePendingCount = { due: number; overdue: number };

// Returns a value that bumps once a minute so consumers can re-evaluate
// wall-clock comparisons without a SQL re-query. Include the returned tick
// in any useMemo dep list that depends on Date.now().
const useMinuteTick = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return tick;
};

export const useCoursePendingCounts = (studentId: number | undefined) => {
  const minuteTick = useMinuteTick();

  // Pure reactive query: only re-fires when rows in the joined tables
  // change. Returns one row per (subject, assessment) so we can classify
  // due vs overdue in JS against the current wall clock.
  const result = usePowerSyncQuery<{
    subject_id: number;
    start_time: string;
    end_time: string;
    submitted_cnt: number | null;
  }>(
    `
    SELECT
      a.subject_id AS subject_id,
      a.start_time AS start_time,
      a.end_time   AS end_time,
      r.cnt        AS submitted_cnt
    FROM activity_activity a
    LEFT JOIN activity_studentactivity sa
      ON sa.activity_id = a.id AND sa.student_id = ?
    LEFT JOIN (
      SELECT student_activity_id, COUNT(*) AS cnt
      FROM activity_retakerecord
      WHERE status = 'submitted'
      GROUP BY student_activity_id
    ) r ON r.student_activity_id = sa.id
    WHERE a.classroom_mode = 0
    `,
    [studentId ?? 0],
  );

  return useMemo(() => {
    const now = Date.now();
    const m = new Map<number, CoursePendingCount>();
    for (const row of result.data ?? []) {
      if (row.submitted_cnt != null) continue;
      const startMs = Date.parse(row.start_time);
      const endMs = Date.parse(row.end_time);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
      if (startMs > now) continue;
      const bucket = m.get(row.subject_id) ?? { due: 0, overdue: 0 };
      if (endMs >= now) bucket.due += 1;
      else bucket.overdue += 1;
      m.set(row.subject_id, bucket);
    }
    return m;
  }, [result.data, minuteTick]);
};
