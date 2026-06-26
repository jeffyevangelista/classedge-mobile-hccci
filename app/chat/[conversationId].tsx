import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import AppInput from "@/components/AppInput";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { markConversationRead } from "@/features/chat/chat.api";
import { CHAT_COPY } from "@/features/chat/chat.copy";
import { useConversation, useMessages } from "@/features/chat/chat.hooks";
import { sendMessage } from "@/features/chat/chat.mutations";
import { useSyncData } from "@/features/sync/useSyncData";
import useStore from "@/lib/store";
import { toTitleCase } from "@/utils/toTitleCase";

const ConversationThreadScreen = () => {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { authUser } = useStore();
  const myUserId = authUser?.id ?? -1;

  const { data: conversationData } = useConversation(conversationId);
  const { data: messages } = useMessages(conversationId, 100);
  const { pendingChanges } = useSyncData();

  const conversation = (
    Array.isArray(conversationData) ? conversationData[0] : conversationData
  ) as
    | {
        id: string;
        type: string;
        subject?: { subjectName?: string } | null;
        participants?: Array<{
          userId: number;
          removedAt: string | null;
          user: { firstName: string; lastName: string };
        }>;
      }
    | undefined;

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const flashListRef = useRef<FlashListRef<(typeof messages)[number]>>(null);

  const headerTitle = useMemo(() => {
    if (!conversation) return "";
    if (conversation.type === "channel") {
      return conversation.subject?.subjectName
        ? `#${conversation.subject.subjectName}`
        : "#Channel";
    }
    const other = conversation.participants?.find(
      (p) => p.userId !== myUserId && !p.removedAt,
    );
    if (!other?.user) return "Conversation";
    return toTitleCase(
      `${other.user.firstName ?? ""} ${other.user.lastName ?? ""}`.trim(),
    );
  }, [conversation, myUserId]);

  const pendingByMessageId = useMemo(() => {
    const set = new Set<string>();
    for (const change of pendingChanges) {
      if (!change) continue;
      if (
        change.table === "chat_message" &&
        typeof change.recordId === "string"
      ) {
        set.add(change.recordId);
      }
    }
    return set;
  }, [pendingChanges]);

  useEffect(() => {
    if (!conversation || !messages || messages.length === 0) return;
    const latest = messages[0];
    if (!latest?.localId) return;
    markConversationRead(conversationId, latest.localId).catch(() => {});
  }, [conversation?.id, messages, conversationId, conversation]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || sending || myUserId < 0) return;
    setSending(true);
    try {
      await sendMessage({
        conversationLocalId: conversationId,
        senderUserId: myUserId,
        body: trimmed,
      });
      setBody("");
      flashListRef.current?.scrollToIndex({ index: 0, animated: true });
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <Stack.Screen options={{ title: headerTitle }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        className="flex-1"
      >
        <FlashList
          ref={flashListRef}
          data={messages ?? []}
          keyExtractor={(item) => item.localId}
          style={{ transform: [{ scaleY: -1 }] }}
          renderItem={({ item }) => {
            const mine = item.senderId === myUserId;
            const isPending = pendingByMessageId.has(item.localId);
            return (
              <View
                style={{ transform: [{ scaleY: -1 }] }}
                className={`mx-3 my-1 max-w-3xl ${
                  mine ? "self-end" : "self-start"
                }`}
              >
                <View
                  className={`px-3 py-2 rounded-2xl ${
                    mine ? "bg-accent" : "bg-muted-foreground/10"
                  }`}
                >
                  <AppText className={mine ? "text-white" : "text-foreground"}>
                    {item.body}
                  </AppText>
                </View>
                {mine && isPending ? (
                  <View className="flex-row items-center justify-end gap-1 mt-0.5">
                    <ActivityIndicator size="small" />
                    <AppText className="text-xs text-muted">
                      {CHAT_COPY.sending}
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
        <View className="border-t border-border px-3 py-2 flex-row items-end gap-2 bg-surface">
          <View className="flex-1">
            <AppInput
              value={body}
              onChangeText={setBody}
              placeholder={CHAT_COPY.composerPlaceholder}
              multiline
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={sending || body.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            className={`size-11 rounded-full items-center justify-center bg-accent ${
              sending || body.trim().length === 0
                ? "opacity-50"
                : "active:opacity-80"
            }`}
          >
            <Icon
              name="PaperPlaneTiltIcon"
              size={20}
              color="white"
              weight="fill"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ConversationThreadScreen;
