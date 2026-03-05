import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

export function useFormattedTime(
  timeString?: string | Date,
  options: {
    format?: string;
    includeSeconds?: boolean;
    use24Hour?: boolean;
    timezone?: string;
    relative?: boolean;
  } = {},
) {
  const {
    format,
    includeSeconds = false,
    use24Hour = false,
    timezone: tz,
    relative = false,
  } = options;

  const time = timeString ? dayjs(timeString) : dayjs();

  if (tz) {
    time.tz(tz);
  }

  if (relative) {
    return time.fromNow();
  }

  if (format) {
    return time.format(format);
  }

  // Default formatting based on options
  let timeFormat = use24Hour ? "HH:mm" : "h:mm A";
  if (includeSeconds) {
    timeFormat = use24Hour ? "HH:mm:ss" : "h:mm:ss A";
  }

  return time.format(timeFormat);
}

export function useTimeAgo(timeString: string | Date) {
  return dayjs(timeString).fromNow();
}

export function useTimeUntil(timeString: string | Date) {
  return dayjs().to(dayjs(timeString));
}

export function useIsTimeInPast(timeString: string | Date) {
  return dayjs(timeString).isBefore(dayjs());
}

export function useIsTimeInFuture(timeString: string | Date) {
  return dayjs(timeString).isAfter(dayjs());
}
