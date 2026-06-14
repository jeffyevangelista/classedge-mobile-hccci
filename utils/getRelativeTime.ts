/**
 * Format a date as a short relative string ("3 min ago", "2 hr ago", "Just now").
 * Falls back to a locale date string for >24 h gaps.
 */
export function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 30_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return date.toLocaleString();
}
