import { and, eq, sql } from "drizzle-orm";
import type { Href } from "expo-router";
import { notificationsTable } from "@/powersync/schema";
import { db } from "@/powersync/system";

export const getNotifications = (userId: string) => {
  return db.query.notificationsTable.findMany({
    with: {
      createdById: true,
    },
    where: (notificationsTable, { eq }) =>
      eq(notificationsTable.userId, Number(userId)),
    orderBy: (notificationsTable, { desc }) =>
      desc(notificationsTable.createdAt),
  });
};

export const readNotification = (notificationId: string) => {
  return db
    .update(notificationsTable)
    .set({
      isRead: 1,
    })
    .where(eq(notificationsTable.id, Number(notificationId)));
};

export const readAllNotifications = (userId: string) => {
  return db
    .update(notificationsTable)
    .set({ isRead: 1 })
    .where(
      and(
        eq(notificationsTable.userId, Number(userId)),
        eq(notificationsTable.isRead, 0),
      ),
    );
};

export const getNotificationCount = (userId: string) => {
  const result = db
    .select({
      count: sql<number>`count(*)`.as("count"),
    })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, Number(userId)),
        eq(notificationsTable.isRead, 0),
      ),
    );

  return result;
};

export const getNotificationHref = (
  entityType: string,
  entityId: string | number,
): Href => {
  const href = (() => {
    switch (entityType) {
      case "lesson":
      case "module":
        return `/material/${entityId}`;
      case "announcement":
        return `/announcement/${entityId}`;
      case "event":
        return `/event/${entityId}`;
      case "conversation":
      case "chat_message":
        return `/chat/${entityId}`;
      default:
        return `/assessment/${entityId}`;
    }
  })();
  return href as Href;
};
