import useStore from "@/lib/store";
import { useQuery } from "@powersync/tanstack-react-query";
import { useQuery as usePowerSyncQuery } from "@powersync/react-native";
import { useEffect, useMemo, useState } from "react";
import {
  getCourseAssessment,
  getCourseDetails,
  getCourseMaterial,
  getCourseTimeline,
  getStudentCourses,
} from "./courses.service";
import { getCourseStudentsApi, getPendingAssessments } from "./courses.apis";
import {
  keepPreviousData,
  useQuery as useApiQuery,
} from "@tanstack/react-query";

export const useStudentCourses = () => {
  const authUser = useStore((state) => state.authUser);

  return useQuery({
    queryKey: ["student", authUser?.id, "courses"],
    enabled: !!authUser?.id,
    queryFn: async () => getStudentCourses(authUser?.id!),
  });
};

export const useCourseTimeline = (courseId: string) => {
  const authUser = useStore((state) => state.authUser);
  return useQuery({
    queryKey: ["course_timeline", courseId, authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const course = await getCourseDetails(courseId);
      return await getCourseTimeline(
        course?.subjectId.id.toString()!,
        authUser!.id,
      );
    },
  });
};

export const useCourseMaterial = (materialId: string) => {
  return useQuery({
    queryKey: ["course-material", materialId],
    queryFn: () => getCourseMaterial(materialId),
  });
};

export const useCourseDetails = (courseId: string) => {
  return useQuery({
    queryKey: ["course-details", courseId],
    queryFn: () => getCourseDetails(courseId),
    enabled: !!courseId,
  });
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

export const useCourseAssessment = (assessmentId: string) => {
  return useQuery({
    queryKey: ["course-assessment", assessmentId],
    queryFn: () => getCourseAssessment(assessmentId),
  });
};

export type CoursePendingCount = { due: number; overdue: number };

export const useCoursePendingCounts = (studentId: number | undefined) => {
  const [nowMinute, setNowMinute] = useState(() =>
    Math.floor(Date.now() / 60_000),
  );
  useEffect(() => {
    const id = setInterval(
      () => setNowMinute(Math.floor(Date.now() / 60_000)),
      60_000,
    );
    return () => clearInterval(id);
  }, []);
  const nowIso = useMemo(
    () => new Date(nowMinute * 60_000).toISOString(),
    [nowMinute],
  );

  const result = usePowerSyncQuery<{
    subject_id: number;
    due: number;
    overdue: number;
  }>(
    `
    SELECT
      a.subject_id AS subject_id,
      SUM(CASE WHEN a.end_time >= ? AND r.cnt IS NULL THEN 1 ELSE 0 END) AS due,
      SUM(CASE WHEN a.end_time <  ? AND r.cnt IS NULL THEN 1 ELSE 0 END) AS overdue
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
      AND a.start_time <= ?
    GROUP BY a.subject_id
    `,
    [nowIso, nowIso, studentId ?? 0, nowIso],
  );

  return useMemo(() => {
    const m = new Map<number, CoursePendingCount>();
    for (const row of result.data ?? []) {
      m.set(row.subject_id, {
        due: row.due ?? 0,
        overdue: row.overdue ?? 0,
      });
    }
    return m;
  }, [result.data]);
};
