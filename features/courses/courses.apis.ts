import api from "@/lib/axios";
import { Assessment } from "./courses.types";

export const getPendingAssessments = async ({
  subjectId,
}: {
  subjectId: string | null;
}): Promise<Assessment[]> => {
  return (await api.get(`/activities/pending/?subject_id=${subjectId}`)).data;
};
