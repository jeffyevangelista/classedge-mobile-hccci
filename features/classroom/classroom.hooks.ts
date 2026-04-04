import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/tanstack-react-query";
import {
  getActivities,
  getActivityById,
  getClassroomStudents,
  getGradingPeriods,
  getStudentScoresForActivity,
} from "./ classroom.service";

export const useClassroomActivities = (subjectId: string) => {
  return useQuery({
    query: toCompilableQuery(getActivities(subjectId)),
    queryKey: ["classroom-activities", subjectId],
  });
};

export const useClassroomActivity = (activityId: string) => {
  return useQuery({
    query: toCompilableQuery(getActivityById(activityId)),
    queryKey: ["classroom-activity", activityId],
  });
};

export const useClassroomGradingPeriods = () => {
  return useQuery({
    query: toCompilableQuery(getGradingPeriods()),
    queryKey: ["classroom-grading-periods"],
  });
};

export const useClassroomStudents = (classroomId: string) => {
  return useQuery({
    query: toCompilableQuery(getClassroomStudents(classroomId)),
    queryKey: ["classroom-students", classroomId],
  });
};

export const useStudentScoresForActivity = (activityId: number) => {
  return useQuery({
    query: toCompilableQuery(getStudentScoresForActivity(activityId)),
    queryKey: ["student-scores", activityId],
  });
};
