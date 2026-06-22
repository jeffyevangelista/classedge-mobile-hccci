import api from "@/lib/axios";
import type { ArchivedCoursesPage } from "./archive.types";

export const getArchivedCoursesApi = async (page: number) => {
  const { data } = await api.get<ArchivedCoursesPage>(
    "/api/mobile/archived-courses/",
    {
      params: { page },
    },
  );
  return data;
};
