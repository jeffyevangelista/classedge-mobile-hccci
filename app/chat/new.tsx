import { useRouter } from "expo-router";
import { Avatar } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import AppInput from "@/components/AppInput";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import EmptyState from "@/components/EmptyState";
import { ScreenList } from "@/components/ScreenList";
import { type DMCandidate, searchDMCandidates } from "@/features/chat/chat.api";
import { CHAT_COPY } from "@/features/chat/chat.copy";
import { createDMConversation } from "@/features/chat/chat.mutations";
import { findDMBetween } from "@/features/chat/chat.service";
import useStore from "@/lib/store";
import { toTitleCase } from "@/utils/toTitleCase";

const NewConversationScreen = () => {
  const router = useRouter();
  const { authUser } = useStore();
  const myUserId = authUser?.id ?? -1;

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<DMCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingFor, setCreatingFor] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchDMCandidates(query.trim());
        if (cancelled) return;
        setCandidates(res.results ?? []);
      } catch (err) {
        if (!cancelled) {
          console.warn("[NewConversation] candidate search failed:", err);
          setCandidates([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const openOrCreateDM = async (otherUserId: number) => {
    if (myUserId < 0 || creatingFor) return;
    setCreatingFor(otherUserId);
    try {
      const existing = await findDMBetween(myUserId, otherUserId);
      if (existing) {
        router.replace(`/chat/${existing}`);
        return;
      }
      const conversationLocalId = await createDMConversation(
        myUserId,
        otherUserId,
      );
      router.replace(`/chat/${conversationLocalId}`);
    } finally {
      setCreatingFor(null);
    }
  };

  const showEmpty = !loading && candidates.length === 0;

  const rows = useMemo(() => candidates, [candidates]);

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 py-3 border-b border-border">
        <AppInput
          value={query}
          onChangeText={setQuery}
          placeholder={CHAT_COPY.recipientSearchPlaceholder}
          autoFocus
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : showEmpty ? (
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            icon="UserCircleIcon"
            title={CHAT_COPY.noRecipientsTitle}
            description={CHAT_COPY.noRecipientsDescription}
          />
        </View>
      ) : (
        <ScreenList
          data={rows}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Start a chat with ${item.fullName}`}
              onPress={() => openOrCreateDM(item.id)}
              disabled={creatingFor === item.id}
              className={`flex-row items-center gap-3 px-4 py-3 max-w-3xl w-full mx-auto active:opacity-70 ${
                creatingFor === item.id ? "opacity-50" : ""
              }`}
            >
              <Avatar alt={item.fullName} size="md">
                {item.photoUrl ? (
                  <Avatar.Image source={{ uri: item.photoUrl }} />
                ) : (
                  <AvatarFallbackImage />
                )}
              </Avatar>
              <View className="flex-1">
                <AppText weight="semibold" numberOfLines={1}>
                  {toTitleCase(item.fullName)}
                </AppText>
                {item.role ? (
                  <AppText className="text-xs text-muted">{item.role}</AppText>
                ) : null}
              </View>
              {creatingFor === item.id ? (
                <ActivityIndicator size="small" />
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
};

export default NewConversationScreen;
