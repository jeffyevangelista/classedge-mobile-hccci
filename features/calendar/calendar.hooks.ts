import { useQuery } from "@powersync/tanstack-react-query";
import { getEvent, getEvents } from "./calendar.service";
import { toCompilableQuery } from "@powersync/drizzle-driver";

export const useEvents = () => {
  return useQuery({
    queryKey: ["events"],
    query: toCompilableQuery(getEvents()),
  });
};

export const useEvent = (eventId: number) => {
  return useQuery({
    queryKey: ["event", eventId],
    query: toCompilableQuery(getEvent(eventId)),
  });
};
