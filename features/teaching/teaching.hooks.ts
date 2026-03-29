import useStore from "@/lib/store";
import { useQuery } from "@powersync/tanstack-react-query";
import { getTeachingCourses } from "./teaching.services";
import { toCompilableQuery } from "@powersync/drizzle-driver";

export const useTeachingCourses = () => {
  const { authUser } = useStore.getState();

  return useQuery({
    queryKey: ["teaching-courses", authUser?.id],
    enabled: !!authUser?.id,
    query: toCompilableQuery(getTeachingCourses(authUser?.id!)),
  });
};
