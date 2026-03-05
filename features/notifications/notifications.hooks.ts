import { useQuery } from "@powersync/tanstack-react-query";
import useStore from "@/lib/store";

import {
  getNotificationCount,
  getNotifications,
} from "./notifications.service";
import { toCompilableQuery } from "@powersync/drizzle-driver";

export const useNotifications = () => {
  const { authUser } = useStore.getState();
  return useQuery({
    queryKey: ["notifications"],
    query: toCompilableQuery(getNotifications(authUser?.id.toString()!)),
  });
};

export const useNotificationCount = () => {
  const { authUser } = useStore.getState();
  return useQuery({
    queryKey: ["notification-count"],
    query: toCompilableQuery(getNotificationCount(authUser?.id.toString()!)),
  });
};
