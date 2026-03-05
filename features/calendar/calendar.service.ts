import { db } from "@/powersync/system";
import { sql } from "drizzle-orm";
import { Event } from "@/powersync/schema";

export const getEvents = () => {
  return db.query.eventsTable.findMany({
    extras: {
      type: sql<"event" | "activity">`'event'`.as("type"),
    },
  });
};

export const getEvent = (eventId: number) => {
  return db.query.eventsTable.findFirst({
    with: {
      createdById: true,
    },
    where: (events, { eq }) => eq(events.id, eventId),
  });
};
