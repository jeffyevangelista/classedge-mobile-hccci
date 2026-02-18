import api from "@/lib/axios";
import { CalendarItem } from "./calendar.types";

export const getCalendarItems = async (): Promise<CalendarItem[]> => {
  return (await api.get("/calendar/")).data;
};
