import { useInfiniteQuery } from "@tanstack/react-query";
import useStore from "@/lib/store";
import { getArchivedCoursesApi } from "./archive.apis";

export const useArchivedCourses = () => {
  const authUser = useStore((s) => s.authUser);

  return useInfiniteQuery({
    queryKey: ["archived-courses", authUser?.id],
    enabled: !!authUser?.id,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getArchivedCoursesApi(pageParam as number),
    getNextPageParam: (last) =>
      last.pagination.hasNext ? last.pagination.page + 1 : undefined,
  });
};
