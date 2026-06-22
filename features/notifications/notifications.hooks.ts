import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react-native";
import useStore from "@/lib/store";
import {
  getNotificationCount,
  getNotifications,
} from "./notifications.service";

export const useNotifications = () => {
  const { authUser } = useStore.getState();
  const { data, isLoading, isFetching, error, refresh } = useQuery(
    toCompilableQuery(getNotifications(authUser?.id.toString()!)),
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

export const useNotificationCount = () => {
  const { authUser } = useStore.getState();
  const { data, isLoading, isFetching, error, refresh } = useQuery(
    toCompilableQuery(getNotificationCount(authUser?.id.toString()!)),
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
