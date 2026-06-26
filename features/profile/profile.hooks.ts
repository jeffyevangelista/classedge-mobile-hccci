import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery as usePowerSyncQuery } from "@powersync/react-native";
import { useQuery } from "@tanstack/react-query";
import useStore from "@/lib/store";
import {
  getAcademicRecords,
  getAcademicTerms,
  getFinancialInformation,
} from "./profile.apis";
import { getStudentCourseSchedules, getUserDetails } from "./user.service";

export const useUserDetails = () => {
  const authUser = useStore((state) => state.authUser);

  return usePowerSyncQuery(
    toCompilableQuery(getUserDetails(authUser?.id!)),
  );
};

// Watch-backed enrolled-course schedules. Mirrors `useStudentCourses`:
// the query builder is wrapped with `toCompilableQuery` so PowerSync
// watches `course_subjectenrollment`, `subject_subject`, and
// `subject_schedule`, re-emitting on every sync update. studentId = 0
// when unauthenticated returns an empty result, gating naturally without
// `enabled`.
export const useClassSchedule = () => {
  const authUser = useStore((state) => state.authUser);
  const studentId = authUser?.id ?? 0;

  const { data, isLoading, isFetching, error, refresh } = usePowerSyncQuery(
    toCompilableQuery(getStudentCourseSchedules(studentId)),
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

export const useFinancialInformation = (academicTermId?: number) => {
  return useQuery({
    queryKey: ["financial-information", academicTermId ?? null],
    queryFn: () => getFinancialInformation(academicTermId),
  });
};

export const useAcademicRecords = () => {
  return useQuery({
    queryKey: ["academic-records"],
    queryFn: () => getAcademicRecords(),
  });
};

export const useAcademicTerms = () => {
  return useQuery({
    queryKey: ["academic-terms"],
    queryFn: () => getAcademicTerms(),
  });
};
