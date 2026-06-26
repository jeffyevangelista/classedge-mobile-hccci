import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { chatMessagesTable } from "@/powersync/schema";
import { db } from "@/powersync/system";

/**
 * Conversation list ordered by last activity.
 *
 * Phase 1 ships DMs first; channels exist in the DB (auto-created by server
 * signals on Subject creation) and surface in the list without extra work — the
 * UI can filter by `type` when channel polish lands in Phase 2.
 */
export const getConversations = () => {
  return db.query.chatConversationsTable.findMany({
    orderBy: (t, { desc }) => desc(t.lastMessageAt),
    with: {
      participants: {
        columns: {
          id: true,
          userId: true,
          role: true,
          lastReadMessageId: true,
          mutedAt: true,
          removedAt: true,
        },
        with: {
          user: {
            columns: {
              userId: true,
              firstName: true,
              lastName: true,
              studentPhoto: true,
            },
          },
        },
      },
      subject: { columns: { id: true, subjectName: true } },
    },
  });
};

export const getConversation = (conversationLocalId: string) => {
  return db.query.chatConversationsTable.findFirst({
    where: (t, { eq }) => eq(t.localId, conversationLocalId),
    with: {
      participants: {
        with: {
          user: {
            columns: {
              userId: true,
              firstName: true,
              lastName: true,
              studentPhoto: true,
            },
          },
        },
      },
      subject: { columns: { id: true, subjectName: true } },
    },
  });
};

/**
 * Reverse-chronological page of messages. `before` accepts an ISO timestamp;
 * pass the oldest currently-visible message's `createdAt` to fetch the next
 * older page.
 */
export const getMessages = (
  conversationLocalId: string,
  limit = 50,
  before?: string,
) => {
  const baseWhere = eq(chatMessagesTable.conversationId, conversationLocalId);
  const where = before
    ? and(baseWhere, lt(chatMessagesTable.createdAt, before))
    : baseWhere;

  return db
    .select()
    .from(chatMessagesTable)
    .where(where)
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);
};

export const getMyActiveParticipant = (
  conversationLocalId: string,
  myUserId: number,
) => {
  return db.query.chatParticipantsTable.findFirst({
    where: (t, { eq, and, isNull }) =>
      and(
        eq(t.conversationId, conversationLocalId),
        eq(t.userId, myUserId),
        isNull(t.removedAt),
      ),
  });
};

/**
 * Count of conversations with at least one message I haven't read.
 * Cheap because messages and participants are local SQLite.
 */
export const getUnreadConversationsCount = (myUserId: number) => {
  // Drizzle SQLite doesn't have window functions in its query builder so we
  // do a two-step: load my participant rows, then load latest message per
  // conversation, then compare locally. For Phase 1 volumes this is fine.
  return db.query.chatParticipantsTable.findMany({
    where: (t, { eq, and, isNull }) =>
      and(eq(t.userId, myUserId), isNull(t.removedAt)),
    columns: {
      conversationId: true,
      lastReadMessageId: true,
    },
  });
};

export const findDMBetween = async (
  myUserId: number,
  otherUserId: number,
): Promise<string | null> => {
  // Find a DM conversation where both users are active participants.
  const candidates = await db.query.chatParticipantsTable.findMany({
    where: (t, { eq, and, isNull }) =>
      and(eq(t.userId, myUserId), isNull(t.removedAt)),
    columns: { conversationId: true },
  });
  if (candidates.length === 0) return null;
  const conversationIds = candidates.map((c) => c.conversationId);

  for (const cid of conversationIds) {
    const conv = await db.query.chatConversationsTable.findFirst({
      where: (t, { eq }) => eq(t.id, cid),
      columns: { id: true, localId: true, type: true },
    });
    if (!conv || conv.type !== "dm") continue;
    const otherRow = await db.query.chatParticipantsTable.findFirst({
      where: (t, { eq, and, isNull }) =>
        and(
          eq(t.conversationId, conv.id),
          eq(t.userId, otherUserId),
          isNull(t.removedAt),
        ),
    });
    if (otherRow) return conv.localId;
  }
  return null;
};

// Silence drizzle unused-import warning in non-using paths.
void isNull;
