import api from "@/lib/axios";

export const getOversightCourses = async () => {
  return (await api.get("/subjects/")).data;
};
