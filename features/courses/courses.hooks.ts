import useStore from "@/lib/store";
import { useQuery } from "@powersync/tanstack-react-query";
import {
  getCourseDetails,
  getCourseMaterial,
  getCourseStudents,
  getCourseTimeline,
  getStudentCourses,
} from "./courses.service";

export const useStudentCourses = () => {
  const { authUser } = useStore.getState();

  return useQuery({
    queryKey: ["student", authUser?.id, "courses"],
    enabled: !!authUser?.id,
    queryFn: async () => getStudentCourses(authUser?.id!),
  });
};

export const useCourseTimeline = (courseId: string) => {
  return useQuery({
    queryKey: ["course_timeline", courseId],
    queryFn: async () => getCourseTimeline(courseId),
  });
};

export const useCourseMaterial = (materialId: string) => {
  return useQuery({
    queryKey: ["course-material", materialId],
    queryFn: () => getCourseMaterial(materialId),
  });
};

export const useCourseDetails = (courseId: string) => {
  return useQuery({
    queryKey: ["course-details", courseId],
    queryFn: () => getCourseDetails(courseId),
  });
};

export const useCourseStudents = (subjectId: number | undefined) => {
  return useQuery({
    queryKey: ["course-students", subjectId],
    enabled: !!subjectId,
    queryFn: () => getCourseStudents(subjectId!),
  });
};
