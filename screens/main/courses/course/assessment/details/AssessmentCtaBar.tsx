import { View } from "react-native";
import { Button } from "heroui-native";
import { AppText } from "@/components/AppText";

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

export const AssessmentCtaBar = ({
  state,
  starting,
  onStart,
  bottomInset,
}: Props) => {
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
        <AppText className="text-sm text-muted text-center">
          This assessment is past due.
        </AppText>
      </View>
    );
  }

  // state.kind === "start"
  const isLate = state.late === true;
  return (
    <View
      className="p-4 bg-surface border-t border-border"
      style={containerStyle}
    >
      {isLate ? (
        <AppText className="text-xs text-danger text-center mb-2">
          ⚠ Past due — submissions count as late
        </AppText>
      ) : null}
      <Button variant="primary" onPress={onStart} isDisabled={starting}>
        <Button.Label>
          {starting ? "Starting…" : "Start Assessment"}
        </Button.Label>
      </Button>
    </View>
  );
};
