import { Pressable } from "react-native";
import useStore from "@/lib/store";
import { useRouter } from "expo-router";
import { AppText } from "@/components/AppText";
import { useAttemptRecords } from "../assessment.hooks";
import { FlashList } from "@shopify/flash-list";
import { Surface } from "heroui-native";
import { useAssessmentTimer } from "@/hooks/useAssessmentTimer";

type AssessmentAttemptsProps = {
  assessmentData: any;
};

const AssessmentAttempts = ({ assessmentData }: AssessmentAttemptsProps) => {
  const { authUser } = useStore();
  const { data, isLoading, isError, error } = useAttemptRecords(
    assessmentData.id,
    authUser?.id!,
  );

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>Error: {error?.message}</AppText>;

  return (
    <FlashList
      data={data}
      renderItem={({ item }) => <AttemptCard item={item} />}
      keyExtractor={(item) => item.localId}
    />
  );
};

const AttemptCard = ({ item }: { item: any }) => {
  const router = useRouter();

  const { formattedTime, remainingTime } = useAssessmentTimer(
    item?.startedAt || new Date().toISOString(),
    item?.duration || 0,
    () => {
      // Handle time up
    },
  );

  return (
    <Pressable
      disabled={item.status !== "in_progress"}
      onPress={() => router.push(`/attempt/${item.localId}`)}
      className="mb-1"
    >
      <Surface
        variant={item.status !== "in_progress" ? "tertiary" : "default"}
        className="rounded-xl shadow-none flex-row justify-between items-center"
      >
        <AppText>Attempt {item.retakeNumber}</AppText>

        <AppText className={remainingTime < 60 ? "text-red-500" : ""}>
          {formattedTime}
        </AppText>
      </Surface>
    </Pressable>
  );
};

export default AssessmentAttempts;
