import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react-native";
import {
  getActivityTypes,
  getClassroomStudents,
  getGradingPeriods,
} from "./ classroom.service";
import { snakeToCamel } from "@/lib/case-transform";
import type { Assessment } from "@/powersync/schema";
import { studentAssessment, coursesTable } from "@/powersync/schema";
import type { InferSelectModel } from "drizzle-orm";

type StudentAssessment = InferSelectModel<typeof studentAssessment>;
type Course = InferSelectModel<typeof coursesTable>;

const wrap = <T>(result: {
  data: T;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | undefined;
  refresh?: (signal?: AbortSignal) => Promise<void>;
}) => ({
  ...result,
  isError: !!result.error,
  refetch: result.refresh ?? (async () => {}),
  isRefetching: result.isFetching && !result.isLoading,
});

export const useClassroomActivities = (subjectId: string) => {
  const result = useQuery(
    "SELECT * FROM activity_activity WHERE subject_id = ? AND classroom_mode = 1 ORDER BY start_time DESC",
    [parseInt(subjectId)],
  );

  return { ...wrap(result), data: snakeToCamel<Assessment[]>(result.data) };
};

export const useClassroomActivity = (activityId: string) => {
  const result = useQuery(
    "SELECT * FROM activity_activity WHERE local_id = ? LIMIT 1",
    [activityId],
  );

  return { ...wrap(result), data: snakeToCamel<Assessment[]>(result.data) };
};

export const useClassroomGradingPeriods = () => {
  return wrap(useQuery(toCompilableQuery(getGradingPeriods())));
};

export const useActivityTypes = () => {
  return wrap(useQuery(toCompilableQuery(getActivityTypes())));
};

export const useClassroomStudents = (classroomId: string) => {
  return wrap(useQuery(toCompilableQuery(getClassroomStudents(classroomId))));
};

export const useStudentScoresForActivity = (activityLocalId: string) => {
  const result = useQuery(
    "SELECT * FROM activity_studentactivity WHERE activity_local_id = ?",
    [activityLocalId],
  );

  return {
    ...wrap(result),
    data: snakeToCamel<StudentAssessment[]>(result.data),
  };
};

export const useClassroom = (classroomId: string) => {
  const result = useQuery(
    "SELECT * FROM subject_subject WHERE id = ? LIMIT 1",
    [parseInt(classroomId)],
  );

  return { ...wrap(result), data: snakeToCamel<Course[]>(result.data) };
};
