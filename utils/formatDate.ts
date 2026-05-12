import dayjs from "dayjs";

export function formatDate(dateString: string, includeTime = false) {
  const date = dayjs(dateString);

  if (includeTime) {
    return date.format("MMM D, YYYY h:mm A");
  }

  return date.format("MMM D, YYYY");
}
