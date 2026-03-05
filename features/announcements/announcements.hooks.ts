import { useQuery } from "@powersync/tanstack-react-query";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { getAnnouncementsWithEvents } from "./announcements.service";

export const useAnnouncementsWithEvents = () => {
  return useQuery({
    queryKey: ["announcements-with-events"],
    query: toCompilableQuery(getAnnouncementsWithEvents()),
  });
};
