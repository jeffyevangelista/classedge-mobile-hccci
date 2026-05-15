// features/assessment/formatters.ts

export const formatDuration = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const formatDueDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const formatShortDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const formatPassingScore = (
  passingScore: number,
  passingScoreType: string,
  maxScore: number,
): string => {
  if (passingScoreType === "percent") return `${passingScore}%`;
  return `${passingScore} / ${maxScore}`;
};

export const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
