import useStore from "@/lib/store";
import { useQuery as usePowersyncQuery } from "@powersync/tanstack-react-query";
import { getStudentCourseSchedules, getUserDetails } from "./user.service";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import {
  getAcademicRecords,
  getAcademicTerms,
  getFinancialInformation,
} from "./profile.apis";
import { useQuery } from "@tanstack/react-query";
import { useQuery as usePowersyncReactQuery } from "@powersync/react";

export const useUserDetails = () => {
  const authUser = useStore((state) => state.authUser);

  return usePowersyncReactQuery(
    toCompilableQuery(getUserDetails(authUser?.id!)),
    [authUser?.id],
  );
};

export const useClassSchedule = () => {
  const authUser = useStore((state) => state.authUser);
  return usePowersyncQuery({
    queryKey: ["class-schedule", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: () => getStudentCourseSchedules(authUser?.id!),
  });
};

export const useFinancialInformation = () => {
  return useQuery({
    queryKey: ["financial-information"],
    queryFn: () => getFinancialInformation(),
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
