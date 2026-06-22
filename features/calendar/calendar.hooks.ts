import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react-native";
import { getEvent, getEvents } from "./calendar.service";

export const useEvents = () => {
  const { data, isLoading, isFetching, error, refresh } = useQuery(
    toCompilableQuery(getEvents()),
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

export const useEvent = (eventId: number) => {
  const { data, isLoading, isFetching, error, refresh } = useQuery(
    toCompilableQuery(getEvent(eventId)),
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
