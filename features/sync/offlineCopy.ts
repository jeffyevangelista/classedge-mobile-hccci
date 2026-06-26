// features/sync/offlineCopy.ts

export type OfflineSection =
  | "home"
  | "courses"
  | "calendar"
  | "notifications"
  | "oversight"
  | "teaching"
  | "announcements"
  | "schedule"
  | "campus-news"
  | "chat";

export const offlineCopy: Record<OfflineSection, string> = {
  home: "Connect to load your dashboard",
  courses: "Connect to load your courses",
  calendar: "Connect to load your schedule",
  notifications: "Connect to load your notifications",
  oversight: "Connect to load your oversight data",
  teaching: "Connect to load your classes",
  announcements: "Connect to load announcements",
  schedule: "Connect to load your class schedule",
  "campus-news": "Connect to load campus news",
  chat: "Connect to load your conversations",
};
