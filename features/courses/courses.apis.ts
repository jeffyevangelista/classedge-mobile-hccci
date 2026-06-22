import api from "@/lib/axios";
import type { Assessment } from "./courses.types";

export const getCourseStudentsApi = async (subjectId: number) => {
  return (await api.get(`/subject/${subjectId}/students/`)).data;
};

export const getPendingAssessments = async ({
  subjectId,
}: {
  subjectId: string | null;
}): Promise<Assessment[]> => {
  return (await api.get(`/activities/pending/?subject_id=${subjectId}`)).data;
};
