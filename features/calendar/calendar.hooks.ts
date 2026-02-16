import { useQuery } from "@tanstack/react-query";
import { getCalendarItems } from "./calendar.apis";

export const useCalendarItems = () => {
  return useQuery({
    queryKey: ["calendar-items"],
    queryFn: getCalendarItems,
  });
};
