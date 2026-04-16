import dayjs from "dayjs";
import { CalendarItem } from "../calendar.types";

export function getItemsForDate(
  data: CalendarItem[],
  dateString: string,
): (CalendarItem & { category: "event" | "activity" })[] {
  const results: any[] = [];

  data.forEach((item) => {
    if (item.type === "event") {
      if (dateString >= item.startDate && dateString <= item.endDate) {
        results.push({ ...item, category: "event" });
      }
    }

    if (item.type === "activity") {
      let start = dayjs(item.start);
      let end = dayjs(item.end);

      let cursor = start;

      while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
        const d = cursor.format("YYYY-MM-DD");
        if (d === dateString) {
          results.push({ ...item, category: "activity" });
        }
        cursor = cursor.add(1, "day");
      }
    }
  });

  return results;
}
