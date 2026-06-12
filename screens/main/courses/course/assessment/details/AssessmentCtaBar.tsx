import { Pressable, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

export type CtaState =
  | { kind: "start"; late?: boolean }
  | { kind: "max-reached"; maxRetake: number }
  | { kind: "past-due-blocked" };

interface Props {
  state: CtaState;
  starting: boolean;
  onStart: () => void;
  bottomInset: number;
}

const START_BG = "#2563eb";
const LATE_BG = "#d97706";

export const AssessmentCtaBar = ({
  state,
  starting,
  onStart,
  bottomInset,
}: Props) => {
  const mutedColor = useThemeColor("muted");
  const dangerColor = useThemeColor("danger");

  const containerStyle = {
    paddingBottom: Math.max(bottomInset, 16),
  };

  if (state.kind === "max-reached") {
    return null;
  }

  if (state.kind === "past-due-blocked") {
    return (
      <View
        className="p-4 bg-surface border-t border-border"
        style={containerStyle}
      >
        <View className="flex-row items-center gap-2.5 px-4 py-3 rounded-2xl bg-default">
          <Icon name="LockSimpleIcon" size={18} color={mutedColor} />
          <AppText className="text-sm text-muted flex-1">
            This assessment is past due.
          </AppText>
        </View>
      </View>
    );
  }

  // state.kind === "start"
  const isLate = state.late === true;
  const label = starting ? "Starting…" : "Start Assessment";
  const backgroundColor = isLate ? LATE_BG : START_BG;

  return (
    <View
      className="p-4 bg-surface border-t border-border"
      style={containerStyle}
    >
      {isLate ? (
        <View className="flex-row items-center gap-1.5 self-center mb-3 px-3 py-1.5 rounded-full bg-danger-soft">
          <Icon name="WarningCircleIcon" size={14} color={dangerColor} />
          <AppText weight="semibold" className="text-xs text-danger">
            Past due · submissions count as late
          </AppText>
        </View>
      ) : null}

      <Pressable
        onPress={onStart}
        disabled={starting}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: starting, busy: starting }}
        android_ripple={{
          color: "rgba(255,255,255,0.18)",
          borderless: false,
        }}
        className={`rounded-full overflow-hidden ${
          starting ? "opacity-60" : "active:opacity-90"
        }`}
      >
        <View
          style={{
            backgroundColor,
            paddingVertical: 14,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Icon name="PlayCircleIcon" size={20} color="#ffffff" />
          <AppText weight="semibold" className="text-base text-white">
            {label}
          </AppText>
          <Icon
            name="CaretRightIcon"
            size={14}
            color="rgba(255,255,255,0.85)"
            style={{ marginLeft: 2 }}
          />
        </View>
      </Pressable>
    </View>
  );
};
