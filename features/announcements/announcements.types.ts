import { getAnnouncementsWithEvents } from "./announcements.service";

export type AnnouncementWithEvents = Awaited<
  ReturnType<typeof getAnnouncementsWithEvents>
>[number];
