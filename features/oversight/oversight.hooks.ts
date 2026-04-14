import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import {
  getAssessment,
  getAssessments,
  getLesson,
  getLessons,
  getStudents,
  getSubject,
  getSubjects,
} from "./oversight.apis";

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

export const useLessons = (courseId: string) => {
  return useInfiniteQuery({
    queryKey: ["course-materials", courseId],
    queryFn: ({ pageParam = 1 }) => getLessons({ pageParam, courseId }),
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
    enabled: !!courseId,
  });
};

export const useLesson = (id: string) => {
  return useQuery({
    queryKey: ["course-lesson", id],
    queryFn: () => getLesson(id),
  });
};

export const useAssessments = (courseId: string, classroomMode: boolean) => {
  return useInfiniteQuery({
    queryKey: ["course-assessments", courseId],
    queryFn: ({ pageParam = 1 }) =>
      getAssessments({ pageParam, courseId, classroomMode }),
    getNextPageParam: (lastPage) => {
      if (lastPage.next) {
        const url = new URL(lastPage.next);
        const page = url.searchParams.get("page");
        return page ? parseInt(page, 10) : undefined;
      }
      return undefined;
    },
    initialPageParam: 1,
    // placeholderData: keepPreviousData,
    enabled: !!courseId,
  });
};

export const useAssessment = (assessmentId: string) => {
  return useQuery({
    queryKey: ["course-assessment", assessmentId],
    queryFn: () => getAssessment(assessmentId),
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
    refetchOnMount: "always", // Always refetch to get latest attempt status
    enabled: !!assessmentId,
  });
};

export const useStudents = (courseId: string) => {
  return useInfiniteQuery({
    queryKey: ["course-students", courseId],
    queryFn: ({ pageParam = 1 }) => getStudents({ pageParam, courseId }),
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
    enabled: !!courseId,
  });
};
