import { createId } from "@paralleldrive/cuid2";
import { eq, sql } from "drizzle-orm";
import {
  chatConversationsTable,
  chatMessageAttachmentsTable,
  chatMessagesTable,
  chatMessageVisibilityTable,
  chatParticipantsTable,
  chatReactionsTable,
} from "@/powersync/schema";
import { db } from "@/powersync/system";

const utcNowIso = () => new Date().toISOString();

export type SendMessageInput = {
  conversationLocalId: string;
  senderUserId: number;
  body: string;
  attachments?: Array<{
    fileUri: string;
    mimeType?: string;
    byteSize?: number;
    originalName?: string;
  }>;
  replyToLocalId?: string;
};

/**
 * Insert a message locally. PowerSync's CRUD queue picks it up and PUTs to
 * `${API_URL}/chat_message/<local_id>/` (multipart for any attachment rows
 * carrying a `file://` URI). Bumps the parent conversation's last_* fields
 * optimistically; the server applies a conditional update so reorders are
 * eventually consistent.
 */
export const sendMessage = async (input: SendMessageInput): Promise<string> => {
  const localId = createId();
  const createdAt = utcNowIso();
  const trimmedBody = input.body.trim();

  await db.insert(chatMessagesTable).values({
    id: localId,
    localId,
    conversationId: input.conversationLocalId,
    senderId: input.senderUserId,
    body: trimmedBody,
    replyToId: input.replyToLocalId ?? null,
    createdAt,
  });

  if (input.attachments && input.attachments.length > 0) {
    await db.insert(chatMessageAttachmentsTable).values(
      input.attachments.map((a) => {
        const attLocalId = createId();
        return {
          id: attLocalId,
          localId: attLocalId,
          messageId: localId,
          file: a.fileUri,
          mimeType: a.mimeType ?? "",
          byteSize: a.byteSize ?? null,
          originalName: a.originalName ?? "",
        };
      }),
    );
  }

  await db
    .update(chatConversationsTable)
    .set({
      lastMessageAt: createdAt,
      lastMessagePreview: (trimmedBody || "📎 Attachment").slice(0, 140),
    })
    .where(eq(chatConversationsTable.localId, input.conversationLocalId));

  return localId;
};

export const markRead = async (
  conversationLocalId: string,
  messageLocalId: string,
  myUserId: number,
): Promise<void> => {
  await db
    .update(chatParticipantsTable)
    .set({ lastReadMessageId: messageLocalId })
    .where(
      sql`${chatParticipantsTable.conversationId} = ${conversationLocalId}
        AND ${chatParticipantsTable.userId} = ${myUserId}
        AND ${chatParticipantsTable.removedAt} IS NULL`,
    );
};

export const hideMessageForMe = async (
  messageLocalId: string,
  myUserId: number,
): Promise<void> => {
  const localId = createId();
  await db.insert(chatMessageVisibilityTable).values({
    id: localId,
    localId,
    messageId: messageLocalId,
    userId: myUserId,
    hiddenAt: utcNowIso(),
  });
};

export const reactToMessage = async (
  messageLocalId: string,
  emoji: string,
  myUserId: number,
): Promise<void> => {
  const localId = createId();
  await db.insert(chatReactionsTable).values({
    id: localId,
    localId,
    messageId: messageLocalId,
    userId: myUserId,
    emoji,
    createdAt: utcNowIso(),
  });
};

/**
 * Create a DM Conversation with the requester as the creator, plus the two
 * participant rows. All three rows queue for upload; the server validates
 * can_user_dm() on the message side too, so a bad pair fails clearly when
 * the first message is sent.
 */
export const createDMConversation = async (
  myUserId: number,
  otherUserId: number,
): Promise<string> => {
  const conversationLocalId = createId();
  await db.insert(chatConversationsTable).values({
    id: conversationLocalId,
    localId: conversationLocalId,
    type: "dm",
    subjectId: null,
    createdById: myUserId,
    lastMessageAt: null,
    lastMessagePreview: "",
    createdAt: utcNowIso(),
  });

  const mineId = createId();
  const theirsId = createId();
  await db.insert(chatParticipantsTable).values([
    {
      id: mineId,
      localId: mineId,
      conversationId: conversationLocalId,
      userId: myUserId,
      role: "owner",
      joinedAt: utcNowIso(),
    },
    {
      id: theirsId,
      localId: theirsId,
      conversationId: conversationLocalId,
      userId: otherUserId,
      role: "member",
      joinedAt: utcNowIso(),
    },
  ]);

  return conversationLocalId;
};

/**
 * Bump a local row's `updated_at` (no real field — we touch
 * `last_message_preview` if message, or `joined_at` if participant) to
 * re-enqueue the row for upload. Reserved for the "tap to retry" UX in the
 * thread when crudMeta shows a stuck op. The server-side upsert is
 * idempotent so this is safe.
 */
export const retryMessageUpload = async (
  messageLocalId: string,
): Promise<void> => {
  // No-op trigger row update — touch `editedAt` to force PowerSync to enqueue
  // a PATCH op. Reuses the existing CRUD queue.
  await db
    .update(chatMessagesTable)
    .set({ editedAt: utcNowIso() })
    .where(eq(chatMessagesTable.localId, messageLocalId));
};
