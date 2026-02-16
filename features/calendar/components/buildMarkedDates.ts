import dayjs from "dayjs";
import { CalendarItem } from "../calendar.types";

type Marking = {
  marked?: boolean;
  dots?: { color: string }[];
  startingDay?: boolean;
  endingDay?: boolean;
  color?: string;
  textColor?: string;
  selected?: boolean;
  selectedColor?: string;
};

export type MarkedDates = Record<string, Marking>;

export function buildMarkedDates(data: CalendarItem[]): MarkedDates {
  const marks: MarkedDates = {};

  const addDot = (date: string, color: string) => {
    marks[date] = {
      ...(marks[date] || {}),
      marked: true,
      dots: [...(marks[date]?.dots || []), { color }],
    };
  };

  const addRange = (startStr: string, endStr: string, color: string) => {
    if (!startStr || !endStr) return;

    let start = dayjs(startStr);
    let end = dayjs(endStr);

    let cursor = start;

    while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
      const date = cursor.format("YYYY-MM-DD");
      const isStart = cursor.isSame(start, "day");
      const isEnd = cursor.isSame(end, "day");

      marks[date] = {
        ...(marks[date] || {}),
        startingDay: isStart,
        endingDay: isEnd,
        color,
        textColor: "black",
      };

      cursor = cursor.add(1, "day");
    }
  };

  data.forEach((item) => {
    if (item.type === "event") {
      const { start_date, end_date } = item;

      if (!start_date || !end_date) return;

      // One-day event
      if (start_date === end_date) {
        marks[start_date] = {
          ...(marks[start_date] || {}),
          startingDay: true,
          endingDay: true,
          color: "#96f7e4",
          textColor: "black",
        };
      } else {
        // Range event
        addRange(start_date, end_date, "#96f7e4");
      }
    }

    if (item.type === "activity") {
      if (!item.start || !item.end) return;

      let start = dayjs(item.start);
      let end = dayjs(item.end);

      let cursor = start;

      while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
        const date = cursor.format("YYYY-MM-DD");
        const dotColor = item.answered ? "#2cc94e" : "#ff5555";
        addDot(date, dotColor);
        cursor = cursor.add(1, "day");
      }
    }
  });

  return marks;
}
