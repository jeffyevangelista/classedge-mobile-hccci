import dayjs from "dayjs";

export function useFormattedDate(
  dateString: string,
  includeTime: boolean = false,
) {
  const date = dayjs(dateString);

  if (includeTime) {
    return date.format("MMM D, YYYY h:mm A");
  }

  return date.format("MMM D, YYYY");
}
