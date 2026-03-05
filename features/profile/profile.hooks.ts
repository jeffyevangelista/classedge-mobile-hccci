import useStore from "@/lib/store";
import { useQuery } from "@powersync/tanstack-react-query";
import { getStudentCourseSchedules, getUserDetails } from "./user.service";
import { toCompilableQuery } from "@powersync/drizzle-driver";

export const useUserDetails = () => {
  const authUser = useStore((state) => state.authUser);

  return useQuery({
    queryKey: ["user-details", authUser?.id],
    enabled: !!authUser,
    query: toCompilableQuery(getUserDetails(authUser?.id!)),
  });
};

export const useClassSchedule = () => {
  const { authUser } = useStore.getState();
  return useQuery({
    queryKey: ["class-schedule", authUser?.id!],
    queryFn: () => getStudentCourseSchedules(authUser?.id!),
  });
};
