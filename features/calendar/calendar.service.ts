import { sql } from "drizzle-orm";
import { db } from "@/powersync/system";

export const getEvents = () => {
  return db.query.eventsTable.findMany({
    with: {
      createdById: {
        columns: {
          firstName: true,
          lastName: true,
        },
      },
    },
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
