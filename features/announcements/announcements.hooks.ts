import { toCompilableQuery } from "@powersync/drizzle-driver";
import { getAnnouncementsWithEvents } from "./announcements.service";
import { useQuery } from "@powersync/react";

export const useAnnouncementsWithEvents = () => {
  return useQuery(toCompilableQuery(getAnnouncementsWithEvents()));
};
