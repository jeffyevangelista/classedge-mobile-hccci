import api from "@/lib/axios";
import { SubjectType } from "./oversight.type";

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
  const res = await api.get(`/subject/?page=${pageParam}`);
  console.log(res.data);
  return res.data;
};

export const getSubject = async (id: string): Promise<SubjectType> => {
  return (await api.get(`/subject/${id}/`)).data;
};
