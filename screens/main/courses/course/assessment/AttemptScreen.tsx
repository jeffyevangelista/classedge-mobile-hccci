import { Animated, View, BackHandler } from "react-native";
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
import { Icon, type IconName } from "@/components/Icon";
import BackButton from "@/components/BackButton";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const AttemptScreen = () => {
  const { attemptId } = useLocalSearchParams();
  const { authUser } = useStore();
  const { toast } = useToast();
  const warningColor = useThemeColor("warning");
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
            <View className="mb-4 gap-2">
              <Dialog.Title>Leave this attempt?</Dialog.Title>
              <Dialog.Description>
                You can come back, but the clock won't pause.
              </Dialog.Description>
            </View>

            <View className="flex-row items-center gap-3 rounded-xl bg-warning-soft border border-warning/30 p-3 mb-4">
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-warning/20">
                <Icon name="ClockIcon" size={18} color={warningColor} />
              </View>
              <View className="flex-1">
                <AppText weight="semibold" className="text-sm text-warning">
                  Timer keeps running
                </AppText>
                <AppText className="text-xs text-warning/80">
                  Any time away counts against your remaining minutes.
                </AppText>
              </View>
            </View>

            <View>
              <Button
                variant="danger"
                onPress={() => {
                  setExitOpen(false);
                  setTimeout(() => routeBack(), 300);
                }}
              >
                <Button.Label>Leave anyway</Button.Label>
              </Button>
              <Button variant="ghost" onPress={() => setExitOpen(false)}>
                <Button.Label>Keep going</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Screen>
  );
};

type TimerState = "normal" | "caution" | "critical" | "time-up";

// State thresholds — when the countdown crosses these, the pill changes
// look. Tuned to give early-warning behavior without being alarmist:
//   normal  → calm
//   caution → 1–5 min, amber pill
//   critical → < 1 min, red pill + pulse
//   time-up  → 0, solid red lock state
const CAUTION_S = 5 * 60;
const CRITICAL_S = 60;

const HeaderTimer = ({ willEndAt }: { willEndAt: string }) => {
  const { formatted, remaining } = useCountdown(willEndAt);

  const foregroundColor = useThemeColor("foreground");
  const warningColor = useThemeColor("warning");
  const dangerColor = useThemeColor("danger");
  const dangerForegroundColor = useThemeColor("danger-foreground");

  const state: TimerState =
    remaining <= 0
      ? "time-up"
      : remaining < CRITICAL_S
        ? "critical"
        : remaining < CAUTION_S
          ? "caution"
          : "normal";

  // Gentle opacity pulse only when critical — telegraphs urgency without
  // shaking the layout.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state !== "critical") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const containerClass =
    state === "time-up"
      ? "bg-danger"
      : state === "critical"
        ? "bg-danger-soft"
        : state === "caution"
          ? "bg-warning-soft"
          : // `border` reads slate-200 in light and slate-800 in dark, so
            // the pill contrasts against the page background in both modes.
            // `default` would visually disappear in light (same slate-100
            // as the page).
            "bg-border";

  const textClass =
    state === "time-up"
      ? "text-danger-foreground"
      : state === "critical"
        ? "text-danger"
        : state === "caution"
          ? "text-warning"
          : "text-foreground";

  const iconColor =
    state === "time-up"
      ? dangerForegroundColor
      : state === "critical"
        ? dangerColor
        : state === "caution"
          ? warningColor
          : foregroundColor;

  const iconName: IconName =
    state === "time-up" ? "XCircleIcon" : "ClockIcon";

  return (
    <Animated.View
      style={{ opacity: pulse }}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${containerClass}`}
      accessibilityLabel={`Time remaining ${formatted}`}
    >
      {state === "critical" ? (
        // Solid dot instead of the clock icon when critical — a stronger,
        // less detailed urgency cue at this small size.
        <View className="w-1.5 h-1.5 rounded-full bg-danger" />
      ) : (
        <Icon name={iconName} size={14} color={iconColor} />
      )}
      <AppText
        weight="bold"
        className={`text-sm ${textClass}`}
        // tabular-nums keeps digits from jittering as the timer ticks.
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {formatted}
      </AppText>
    </Animated.View>
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
