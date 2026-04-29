import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery as useWatchedQuery } from "@powersync/react";
import { useQuery } from "@powersync/tanstack-react-query";
import {
  getActivityTypes,
  getClassroomStudents,
  getGradingPeriods,
  getStudentScoresForActivity,
} from "./ classroom.service";
import { snakeToCamel } from "@/lib/case-transform";
import type { Assessment } from "@/powersync/schema";

export const useClassroomActivities = (subjectId: string) => {
  const result = useWatchedQuery(
    "SELECT * FROM activity_activity WHERE subject_id = ? AND classroom_mode = 1 ORDER BY start_time DESC",
    [parseInt(subjectId)],
  );

  return { ...result, data: snakeToCamel<Assessment[]>(result.data) };
};

export const useClassroomActivity = (activityId: string) => {
  const result = useWatchedQuery(
    "SELECT * FROM activity_activity WHERE local_id = ? LIMIT 1",
    [activityId],
  );

  return {
    ...result,
    data: snakeToCamel<Assessment[]>(result.data),
    isError: !!result.error,
  };
};

export const useClassroomGradingPeriods = () => {
  return useQuery({
    query: toCompilableQuery(getGradingPeriods()),
    queryKey: ["classroom-grading-periods"],
  });
};

export const useActivityTypes = () => {
  return useQuery({
    query: toCompilableQuery(getActivityTypes()),
    queryKey: ["activity-types"],
  });
};

export const useClassroomStudents = (classroomId: string) => {
  return useQuery({
    query: toCompilableQuery(getClassroomStudents(classroomId)),
    queryKey: ["classroom-students", classroomId],
  });
};

export const useStudentScoresForActivity = (activityLocalId: string) => {
  const result = useWatchedQuery(
    "SELECT * FROM activity_studentactivity WHERE activity_local_id = ?",
    [activityLocalId],
  );

  return {
    ...result,
    data: snakeToCamel(result.data),
    isError: !!result.error,
  };
};
