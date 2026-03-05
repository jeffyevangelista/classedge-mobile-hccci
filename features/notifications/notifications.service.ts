import { db } from "@/powersync/system";
import { and, eq, sql } from "drizzle-orm";
import { notificationsTable } from "@/powersync/schema";

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
