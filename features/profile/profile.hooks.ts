import useStore from "@/lib/store";
import { useQuery as usePowersyncQuery } from "@powersync/tanstack-react-query";
import { getStudentCourseSchedules, getUserDetails } from "./user.service";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { getFinancialInformation } from "./profile.apis";
import { useQuery } from "@tanstack/react-query";

export const useUserDetails = () => {
  const authUser = useStore((state) => state.authUser);

  return usePowersyncQuery({
    queryKey: ["user-details", authUser?.id],
    enabled: !!authUser,
    query: toCompilableQuery(getUserDetails(authUser?.id!)),
  });
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
