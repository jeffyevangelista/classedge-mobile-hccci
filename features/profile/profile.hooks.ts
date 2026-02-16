import useStore from "@/lib/store";
import { db } from "@/powersync/system";
import { useQuery } from "@powersync/tanstack-react-query";
import { getUserDetails } from "./user.service";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { getClassSchedule } from "./profile.apis";

export const useUserDetails = () => {
  const { authUser } = useStore.getState();

  return useQuery({
    queryKey: ["user-details", authUser?.id],
    enabled: !!authUser,
    queryFn: async () => {
      if (!authUser) {
        throw new Error("No authenticated user");
      }
      const result = await getUserDetails(authUser.id);
      return result ?? null;
    },
  });
};

export const useClassSchedule = () => {
  return useInfiniteQuery({
    queryKey: ["class_schedule"],
    queryFn: ({ pageParam = 1 }) => getClassSchedule({ pageParam }),
    getNextPageParam: (lastPage) => {
      if (lastPage.next) {
        const url = new URL(lastPage.next);
        const page = url.searchParams.get("page");
        return page ? parseInt(page, 10) : undefined;
      }
      return undefined;
    },
    initialPageParam: 1,
    placeholderData: keepPreviousData,
  });
};
