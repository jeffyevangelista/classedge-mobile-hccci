import api from "@/lib/axios";
import { Assessment, Lesson, Student, SubjectType } from "./oversight.type";

export const getSubjects = async ({
  pageParam = 1,
}: {
  pageParam: number;
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: SubjectType[];
}> => {
  return (await api.get(`/subject/?page=${pageParam}`)).data;
};

export const getSubject = async (id: string): Promise<SubjectType> => {
  return (await api.get(`/subject/${id}/`)).data;
};

export const getLessons = async ({
  pageParam = 1,
  courseId,
}: {
  pageParam: number;
  courseId: string;
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: Lesson[];
}> => {
  return (await api.get(`/subject/${courseId}/lessons/?page=${pageParam}`))
    .data;
};

export const getLesson = async (id: string): Promise<Lesson> => {
  return (await api.get(`/lessons/${id}/`)).data;
};

export const getAssessments = async ({
  pageParam,
  courseId,
  classroomMode = true,
}: {
  pageParam: number;
  classroomMode: boolean;
  courseId: string;
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: Assessment[];
}> => {
  console.log("fetching");

  return (
    await api.get(
      `/subject/${courseId}/activities/?page=${pageParam}&classroom_mode=${classroomMode}`,
    )
  ).data;
};

export const getAssessment = async (courseId: string): Promise<Assessment> => {
  return (await api.get(`/activities/${courseId}/`)).data;
};

export const getStudents = async ({
  pageParam = 1,
  courseId,
}: {
  pageParam: number;
  courseId: string;
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: Student[];
}> => {
  return (await api.get(`/subject/${courseId}/students/?page=${pageParam}`))
    .data;
};
