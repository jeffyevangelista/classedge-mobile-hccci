import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Link, useRouter } from "expo-router";
import { Avatar } from "heroui-native";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import EmptyState from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { ScreenList } from "@/components/ScreenList";
import { CHAT_COPY } from "@/features/chat/chat.copy";
import { useConversations } from "@/features/chat/chat.hooks";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { SectionView } from "@/features/sync/components/SectionView";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import useStore from "@/lib/store";
import { toTitleCase } from "@/utils/toTitleCase";

dayjs.extend(relativeTime);

type ConversationRow = NonNullable<
  ReturnType<typeof useConversations>["data"]
>[number];

const ChatTabScreen = () => {
  const { authUser } = useStore();
  const myUserId = authUser?.id;
  const { data, isLoading } = useConversations();

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  const rows = useMemo(() => data ?? [], [data]);
  const router = useRouter();

  return (
    <View className="flex-1 bg-surface">
      <SectionView status={status}>
        <SectionView.Empty>
          <View className="max-w-3xl w-full mx-auto pt-12 px-6">
            <EmptyState
              icon="ChatCircleIcon"
              title={CHAT_COPY.emptyTitle}
              description={CHAT_COPY.emptyDescription}
            />
          </View>
        </SectionView.Empty>
        <SectionView.OfflineEmpty>
          <OfflineEmpty section="chat" />
        </SectionView.OfflineEmpty>
        <SectionView.Ready>
          <ScreenList
            data={rows}
            renderItem={({ item }) => (
              <View className="max-w-3xl w-full mx-auto">
                <ConversationRowItem item={item} myUserId={myUserId ?? -1} />
              </View>
            )}
          />
        </SectionView.Ready>
      </SectionView>

      <Pressable
        onPress={() => router.push("/chat/new")}
        accessibilityRole="button"
        accessibilityLabel={CHAT_COPY.newConversationCta}
        className="absolute bottom-6 right-6 size-14 rounded-full items-center justify-center bg-accent active:opacity-80 shadow-lg"
      >
        <Icon name="PlusIcon" size={26} color="white" weight="bold" />
      </Pressable>
    </View>
  );
};

type ConversationRowItemProps = {
  item: ConversationRow;
  myUserId: number;
};

type LoadedConversation = ConversationRow & {
  subject?: { id: number; subjectName: string } | null;
  participants?: Array<{
    userId: number;
    removedAt: string | null;
    user: {
      userId: number;
      firstName: string;
      lastName: string;
      studentPhoto: string;
    };
  }>;
};

const ConversationRowItem = ({ item, myUserId }: ConversationRowItemProps) => {
  const conv = item as LoadedConversation;
  const counterpart = useMemo(() => {
    if (conv.type === "channel") {
      return {
        title: conv.subject?.subjectName
          ? `#${conv.subject.subjectName}`
          : "#Channel",
        photo: null as string | null,
      };
    }
    const other = conv.participants?.find(
      (p) => p.userId !== myUserId && !p.removedAt,
    );
    const fullName = other?.user
      ? toTitleCase(
          `${other.user.firstName ?? ""} ${other.user.lastName ?? ""}`.trim(),
        )
      : "Conversation";
    return {
      title: fullName,
      photo: other?.user?.studentPhoto ?? null,
    };
  }, [conv, myUserId]);

  const formattedTime = conv.lastMessageAt
    ? dayjs(conv.lastMessageAt).fromNow()
    : "";

  return (
    <Link href={`/chat/${conv.localId}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open conversation with ${counterpart.title}`}
        className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
      >
        <Avatar alt={counterpart.title} size="lg">
          {counterpart.photo ? (
            <Avatar.Image source={{ uri: counterpart.photo }} />
          ) : (
            <AvatarFallbackImage />
          )}
        </Avatar>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <AppText
              weight="semibold"
              numberOfLines={1}
              className="flex-1 mr-2"
            >
              {counterpart.title}
            </AppText>
            {formattedTime ? (
              <AppText className="text-xs text-muted">{formattedTime}</AppText>
            ) : null}
          </View>
          <AppText className="text-sm text-muted" numberOfLines={1}>
            {item.lastMessagePreview || "No messages yet"}
          </AppText>
        </View>
      </Pressable>
    </Link>
  );
};

export default ChatTabScreen;
