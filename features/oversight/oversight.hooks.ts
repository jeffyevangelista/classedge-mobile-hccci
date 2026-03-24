import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { getSubject, getSubjects } from "./oversight.apis";

export const useGetSubjects = () => {
  return useInfiniteQuery({
    queryKey: ["subjects"],
    queryFn: ({ pageParam = 1 }) => getSubjects({ pageParam }),
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

export const useGetSubject = (id: string) => {
  return useQuery({
    queryKey: ["subject", id],
    queryFn: () => getSubject(id),
  });
};
