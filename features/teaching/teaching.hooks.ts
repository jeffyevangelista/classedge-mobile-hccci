import useStore from "@/lib/store";
import { useQuery } from "@powersync/react-native";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { getTeachingCourses } from "./teaching.services";

export const useTeachingCourses = () => {
  const { authUser } = useStore.getState();

  const { data, isLoading, isFetching, error, refresh } = useQuery(
    toCompilableQuery(getTeachingCourses(authUser?.id!)),
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
