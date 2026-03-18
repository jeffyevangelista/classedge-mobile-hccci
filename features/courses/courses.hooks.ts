import useStore from "@/lib/store";
import { useQuery } from "@powersync/tanstack-react-query";
import {
  getCourseAssessment,
  getCourseDetails,
  getCourseMaterial,
  getCourseStudents,
  getCourseTimeline,
  getStudentCourses,
} from "./courses.service";
import { getPendingAssessments } from "./courses.apis";
import { keepPreviousData } from "@tanstack/react-query";

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
    queryFn: async () => {
      const course = await getCourseDetails(courseId);
      return await getCourseTimeline(course?.subjectId.id.toString()!);
    },
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
    enabled: !!courseId,
  });
};

export const useCourseStudents = (subjectId: number | undefined) => {
  return useQuery({
    queryKey: ["course-students", subjectId],
    enabled: !!subjectId,
    queryFn: () => getCourseStudents(subjectId!),
  });
};

export const usePendingAssessments = (subjectId: string | null) => {
  return useQuery({
    queryKey: ["pending-assessments", subjectId],
    queryFn: () => getPendingAssessments({ subjectId }),
    placeholderData: keepPreviousData,
  });
};

export const useCourseAssessment = (assessmentId: string) => {
  return useQuery({
    queryKey: ["course-assessment", assessmentId],
    queryFn: () => getCourseAssessment(assessmentId),
  });
};
