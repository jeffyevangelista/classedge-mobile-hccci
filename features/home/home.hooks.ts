import { useQuery } from "@powersync/tanstack-react-query";
import {
  addRecentCourse,
  getAnnouncements,
  getRecentCourses,
} from "./home.service";

export const useAnnouncements = () => {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: getAnnouncements,
  });
};

export const useRecentCourses = () => {
  return useQuery({
    queryKey: ["recent-courses"],
    queryFn: getRecentCourses,
  });
};
