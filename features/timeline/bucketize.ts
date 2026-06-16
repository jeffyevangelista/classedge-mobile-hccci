import dayjs from "dayjs";
import type { BucketKey, TimelineItem } from "./types";

export const BUCKET_ORDER: { key: BucketKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This Week" },
  { key: "earlier", label: "Earlier" },
];

export const bucketize = (
  items: TimelineItem[],
): Record<BucketKey, TimelineItem[]> => {
  const today = dayjs().startOf("day");
  const weekCutoff = today.subtract(6, "day");
  const buckets: Record<BucketKey, TimelineItem[]> = {
    upcoming: [],
    today: [],
    thisWeek: [],
    earlier: [],
  };
  for (const item of items) {
    const d = dayjs(item.startDate).startOf("day");
    if (d.isAfter(today)) buckets.upcoming.push(item);
    else if (d.isSame(today)) buckets.today.push(item);
    else if (!d.isBefore(weekCutoff)) buckets.thisWeek.push(item);
    else buckets.earlier.push(item);
  }
  buckets.upcoming.sort(
    (a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  for (const k of ["today", "thisWeek", "earlier"] as const) {
    buckets[k].sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );
  }
  return buckets;
};
