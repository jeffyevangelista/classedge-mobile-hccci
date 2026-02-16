import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useMutation,
} from "@tanstack/react-query";

import {
  getNotificationCount,
  getNotifications,
  readNotification,
} from "./notifications.apis";
import { queryClient } from "@/providers/QueryProvider";

export const useNotifications = () => {
  return useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam = 1 }) => getNotifications({ pageParam }),
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

export const useReadNotification = () => {
  return useMutation({
    mutationKey: ["read-notification"],
    mutationFn: (id: number) => readNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", "notification-count"],
      });
    },
  });
};

export const useNotificationCount = () => {
  return useQuery({
    queryKey: ["notification-count"],
    queryFn: () => getNotificationCount(),
  });
};
