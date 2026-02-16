import { api } from "@/lib/axios";
import { ClassSchedule } from "./profile.types";

export const getClassSchedule = async ({
  pageParam = 1,
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: ClassSchedule[];
}> => {
  return (await api.get(`/class_schedule/?page=${pageParam}`)).data;
};
