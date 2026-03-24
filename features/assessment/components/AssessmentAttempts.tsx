import { Pressable, View } from "react-native";
import { useRef } from "react";
import useStore from "@/lib/store";
import { useRouter } from "expo-router";
import { AppText } from "@/components/AppText";
import { useAttemptRecords } from "../assessment.hooks";
import { FlashList } from "@shopify/flash-list";
import { Skeleton, Surface } from "heroui-native";
import { useAssessmentTimer } from "@/hooks/useAssessmentTimer";
import EmptyState from "@/components/EmptyState";

type AssessmentAttemptsProps = {
  assessmentData: any;
};

const AssessmentAttempts = ({ assessmentData }: AssessmentAttemptsProps) => {
  const { authUser } = useStore();
  const { data, isLoading, isError, error } = useAttemptRecords(
    assessmentData.id,
    authUser?.id!,
  );

  if (isLoading) return <AssessmentAttemptsSkeleton />;
  if (isError) return <AppText>Error: {error?.message}</AppText>;

  return (
    <FlashList
      data={data}
      renderItem={({ item }) => <AttemptCard item={item} />}
      keyExtractor={(item) => item.localId}
      ListEmptyComponent={
        <EmptyState
          icon="ClipboardTextIcon"
          title="No attempts yet"
          description="You haven't attempted this assessment yet"
        />
      }
    />
  );
};

const AttemptCard = ({ item }: { item: any }) => {
  const router = useRouter();

  // For display in the list, compute elapsed from wall clock as a simple estimate
  const elapsedRef = useRef(
    Math.floor(
      (Date.now() - new Date(item?.startedAt || Date.now()).getTime()) / 1000,
    ),
  );

  const { formattedTime, remainingTime } = useAssessmentTimer(
    item?.duration || 0,
    elapsedRef,
  );

  const isOngoing = item.status === "ongoing";

  return (
    <Pressable
      disabled={!isOngoing}
      onPress={() => router.push(`/attempt/${item.localId}`)}
      className="mb-1"
    >
      <Surface
        variant={!isOngoing ? "tertiary" : "default"}
        className="rounded-xl shadow-none flex-row justify-between items-center"
      >
        <AppText>Attempt {item.retakeNumber}</AppText>

        <AppText className={remainingTime < 60 ? "text-red-500" : ""}>
          {isOngoing ? formattedTime : item.status}
        </AppText>
      </Surface>
    </Pressable>
  );
};

const AssessmentAttemptsSkeleton = () => {
  return (
    <View className="gap-1.5">
      {Array(3)
        .fill(0)
        .map((_, index) => (
          <Surface
            key={index}
            variant="tertiary"
            className="rounded-xl shadow-none flex-row justify-between items-center"
          >
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </Surface>
        ))}
    </View>
  );
};

export default AssessmentAttempts;
