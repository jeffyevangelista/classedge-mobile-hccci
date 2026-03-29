import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/tanstack-react-query";
import { getActivities, getGradingPeriods } from "./ classroom.service";

export const useClassroomActivities = (subjectId: string) => {
  return useQuery({
    query: toCompilableQuery(getActivities(subjectId)),
    queryKey: ["classroom-activities", subjectId],
  });
};

export const useClassroomGradingPeriods = () => {
  return useQuery({
    query: toCompilableQuery(getGradingPeriods()),
    queryKey: ["classroom-grading-periods"],
  });
};
