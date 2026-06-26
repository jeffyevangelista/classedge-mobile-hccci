import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react";
import {
  getConversation,
  getConversations,
  getMessages,
  getMyActiveParticipant,
  getUnreadConversationsCount,
} from "./chat.service";

export const useConversations = () => {
  return useQuery(toCompilableQuery(getConversations()));
};

export const useConversation = (conversationLocalId: string) => {
  return useQuery(toCompilableQuery(getConversation(conversationLocalId)));
};

export const useMessages = (
  conversationLocalId: string,
  limit = 50,
  before?: string,
) => {
  return useQuery(
    toCompilableQuery(getMessages(conversationLocalId, limit, before)),
  );
};

export const useMyParticipant = (
  conversationLocalId: string,
  myUserId: number,
) => {
  return useQuery(
    toCompilableQuery(getMyActiveParticipant(conversationLocalId, myUserId)),
  );
};

export const useUnreadConversationParticipants = (myUserId: number) => {
  return useQuery(toCompilableQuery(getUnreadConversationsCount(myUserId)));
};
