import { useQuery } from "@tanstack/react-query";
import { getOversightCourses } from "./oversight.apis";

export const useOversightCourses = () => {
  return useQuery({
    queryKey: ["oversight-courses"],
    queryFn: getOversightCourses,
  });
};
