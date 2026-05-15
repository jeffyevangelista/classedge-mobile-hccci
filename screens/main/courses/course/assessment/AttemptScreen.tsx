import { View, BackHandler } from "react-native";
import Screen from "@/components/screen";
import { useEffect, useCallback, useState, useRef } from "react";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { useGetAssessmentAttempt } from "@/features/assessment/assessment.hooks";
import {
  submitAttempt,
  updateLastIndex,
} from "@/features/assessment/assessment.service";
import { useCountdown } from "@/hooks/useCountdown";
import { useExpiry } from "@/hooks/useExpiry";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import QuestionList from "@/features/assessment/components/QuestionList";
import useStore from "@/lib/store";
import { Skeleton, Dialog, Button, useToast, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import BackButton from "@/components/BackButton";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const AttemptScreen = () => {
  const { attemptId } = useLocalSearchParams();
  const { authUser } = useStore();
  const { toast } = useToast();
  const {
    data: attempt,
    isLoading,
    isError,
    error,
  } = useGetAssessmentAttempt(attemptId as string);
  const navigation = useNavigation();

  const [exitOpen, setExitOpen] = useState(false);
  const submittingRef = useRef(false);

  const routeBack = useCallback(() => {
    // Defer past the current commit so reactive query updates and dialog
    // exit animations don't race react-native-screens.
    setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace({
        pathname: "/(main)/assessment/[assessmentId]",
        params: { assessmentId: String(attempt?.activityId) },
      });
    }, 100);
  }, [attempt?.activityId]);

  const submit = useCallback(async () => {
    if (!attempt || submittingRef.current) return;
    submittingRef.current = true;
    try {
      await submitAttempt(attempt.localId);
    } catch (err) {
      submittingRef.current = false;
      throw err;
    }
  }, [attempt]);

  const onAutoSubmit = useCallback(() => {
    submit()
      .then(routeBack)
      .catch((err) => console.error("[AttemptScreen] auto-submit failed:", err));
  }, [submit, routeBack]);

  const isTimeUp = useExpiry(attempt?.willEndAt, onAutoSubmit);
  useHeartbeat(attempt?.localId);

  const handleSubmit = useCallback(async () => {
    try {
      await submit();
      routeBack();
    } catch (err) {
      console.error("[AttemptScreen] Submit failed:", err);
      toast.show({
        label: "Submit failed",
        description: "Please try again.",
        variant: "danger",
      });
    }
  }, [submit, routeBack, toast]);

  const saveLastIndex = useCallback(
    async (index: number) => {
      if (!attempt) return;
      try {
        await updateLastIndex(attempt.localId, index);
      } catch (err) {
        console.error("[AttemptScreen] Failed to save lastIndex:", err);
      }
    },
    [attempt],
  );

  useEffect(() => {
    if (!attempt || isLoading) return;

    navigation.setOptions({
      gestureEnabled: false,
      headerTitle: () => <HeaderTimer willEndAt={attempt.willEndAt} />,
      headerTitleAlign: "center",
      headerLeft: ({ tintColor }: { tintColor?: string }) => (
        <BackButton
          tintColor={tintColor}
          onPress={() => setExitOpen(true)}
        />
      ),
    });
  }, [navigation, attempt, isLoading]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        setExitOpen(true);
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  if (isLoading) return <AttemptScreenSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;
  if (!attempt)
    return (
      <NoDataFallback
        title="Attempt not found"
        description="This attempt couldn't be loaded."
      />
    );

  const parseQuestionOrder = (raw: unknown): number[] => {
    let value: unknown = raw;
    for (let i = 0; i < 3; i++) {
      if (Array.isArray(value)) return value.map((n) => Number(n));
      if (typeof value !== "string" || value.trim().length === 0) return [];
      try {
        value = JSON.parse(value);
      } catch (err) {
        console.warn(
          "[AttemptScreen] failed to JSON.parse questionOrder:",
          raw,
          err,
        );
        return [];
      }
    }
    return [];
  };

  const questionOrder: number[] = parseQuestionOrder(attempt.questionOrder);

  return (
    <Screen>
      <QuestionList
        activityId={attempt.activityId}
        attemptId={attempt.localId}
        retakeRecordId={attempt.id}
        studentId={authUser?.id!}
        questionOrder={questionOrder}
        initialIndex={attempt.lastIndex}
        onIndexChange={saveLastIndex}
        isTimeUp={isTimeUp}
        onSubmit={handleSubmit}
      />

      <Dialog isOpen={exitOpen} onOpenChange={setExitOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="w-full max-w-lg mx-auto">
            <View className="mb-5 gap-3">
              <Dialog.Title>Leave this attempt?</Dialog.Title>
              <Dialog.Description>
                Your timer keeps running while you're away.
              </Dialog.Description>
            </View>
            <View className="gap-2">
              <Button
                variant="danger"
                onPress={() => {
                  setExitOpen(false);
                  setTimeout(() => routeBack(), 300);
                }}
              >
                Leave
              </Button>
              <Button variant="ghost" onPress={() => setExitOpen(false)}>
                Stay
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Screen>
  );
};

const HeaderTimer = ({ willEndAt }: { willEndAt: string }) => {
  const dangerColor = useThemeColor("danger");
  const { formatted, remaining } = useCountdown(willEndAt);
  return (
    <AppText
      weight="bold"
      style={{ color: remaining < 60 ? dangerColor : undefined }}
    >
      {formatted}
    </AppText>
  );
};

const AttemptScreenSkeleton = () => (
  <View style={{ flex: 1, padding: 16 }} className="gap-6">
    <View className="gap-3">
      <Skeleton className="h-4 w-20 rounded-full" />
      <Skeleton className="h-6 w-full rounded-full" />
      <Skeleton className="h-3 w-full rounded-full" />
      <Skeleton className="h-3 w-3/4 rounded-full" />
    </View>
    <View className="gap-3">
      {Array(4)
        .fill(0)
        .map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
    </View>
    <Skeleton className="h-12 w-full rounded-full mt-auto" />
  </View>
);

export default AttemptScreen;
