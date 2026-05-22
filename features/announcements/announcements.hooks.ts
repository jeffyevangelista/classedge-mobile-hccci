import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react";
import { getAnnouncement, getAnnouncementsWithEvents } from "./announcements.service";

export const useAnnouncementsWithEvents = () => {
  return useQuery(toCompilableQuery(getAnnouncementsWithEvents()));
};

export const useAnnouncement = (announcementId: number) => {
  return useQuery(toCompilableQuery(getAnnouncement(announcementId)));
};
