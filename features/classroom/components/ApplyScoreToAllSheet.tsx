import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, type TextInput, View } from "react-native";
import { Button, Dialog, useThemeColor } from "heroui-native";
import AppInput from "@/components/AppInput";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  maxScore: number;
  totalStudents: number;
  ungradedCount: number;
  onApply: (score: string, options: { skipGraded: boolean }) => void;
};

export const ApplyScoreToAllSheet = ({
  isOpen,
  onOpenChange,
  maxScore,
  totalStudents,
  ungradedCount,
  onApply,
}: Props) => {
  const [defaultScore, setDefaultScore] = useState("");
  // Default to true so the destructive "overwrite saved scores" path
  // is opt-in. A teacher who's already graded some rows by hand
  // doesn't lose that work just by tapping "Apply all".
  const [skipGraded, setSkipGraded] = useState(true);
  const inputRef = useRef<TextInput>(null);

  // Autofocus the score input the moment the sheet opens so the
  // teacher can start typing immediately. Small delay covers the
  // dialog's enter animation.
  useEffect(() => {
    if (!isOpen) {
      setDefaultScore("");
      setSkipGraded(true);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen]);

  const isOverMax =
    defaultScore !== "" && parseInt(defaultScore, 10) > maxScore;
  const isValid =
    defaultScore !== "" &&
    !isOverMax &&
    !isNaN(parseInt(defaultScore, 10)) &&
    parseInt(defaultScore, 10) >= 0;

  const impactCount = skipGraded ? ungradedCount : totalStudents;

  const handleApply = useCallback(() => {
    if (!isValid) return;
    onApply(defaultScore, { skipGraded });
    Keyboard.dismiss();
    onOpenChange(false);
  }, [defaultScore, isValid, onApply, onOpenChange, skipGraded]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    onOpenChange(false);
  }, [onOpenChange]);

  const warningColor = useThemeColor("warning");

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-md mx-auto">
          <View className="gap-4">
            <Dialog.Title>Apply score to all</Dialog.Title>

            {/* Warning chip — replaces the bland "overwrites every
                student's score" description. Tone matches the rest of
                the app's danger/warning surfaces. */}
            {!skipGraded ? (
              <View className="flex-row items-start gap-2 rounded-xl bg-warning-soft border border-warning/30 p-3">
                <View style={{ marginTop: 1 }}>
                  <Icon name="WarningIcon" size={14} color={warningColor} />
                </View>
                <AppText className="flex-1 text-xs text-warning">
                  Existing scores will be replaced. Untoggle "Apply only
                  to ungraded" only if that's what you want.
                </AppText>
              </View>
            ) : null}

            {/* Score input — matches StudentScoreItem chrome. */}
            <View className="flex-row items-center gap-2">
              <AppInput
                ref={inputRef}
                placeholder="0"
                value={defaultScore}
                onChangeText={(text: string) => {
                  if (text !== "" && !/^\d+$/.test(text)) return;
                  setDefaultScore(text);
                }}
                onSubmitEditing={handleApply}
                returnKeyType="done"
                keyboardType="numeric"
                maxLength={String(maxScore).length}
                className={`w-24 text-center text-base font-semibold bg-default border ${
                  isOverMax ? "border-danger" : "border-border"
                }`}
                style={{ fontVariant: ["tabular-nums"] }}
              />
              <AppText className="text-sm text-muted">/ {maxScore}</AppText>
            </View>

            {/* Skip-graded toggle */}
            <Pressable
              onPress={() => setSkipGraded((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skipGraded }}
              accessibilityLabel="Apply only to ungraded students"
              hitSlop={6}
              className="flex-row items-center gap-3 active:opacity-70"
            >
              <View
                className={`w-5 h-5 rounded-md items-center justify-center ${
                  skipGraded
                    ? "bg-accent border border-accent"
                    : "bg-default border border-border"
                }`}
              >
                {skipGraded ? (
                  <Icon name="CheckIcon" size={12} color="#ffffff" />
                ) : null}
              </View>
              <AppText className="flex-1 text-sm text-foreground">
                Apply only to ungraded students
              </AppText>
            </Pressable>

            {/* Impact line */}
            <View className="flex-row items-center gap-1.5">
              <Icon name="UsersThreeIcon" size={14} className="text-muted" />
              <AppText className="text-xs text-muted">
                {impactCount === 0
                  ? "No students will be updated"
                  : impactCount === 1
                    ? "Applies to 1 student"
                    : `Applies to ${impactCount} students`}
              </AppText>
            </View>

            <View className="flex-row gap-2 mt-1">
              <Button
                variant="ghost"
                className="flex-1"
                onPress={handleCancel}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onPress={handleApply}
                isDisabled={!isValid || impactCount === 0}
              >
                Apply
              </Button>
            </View>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ApplyScoreToAllSheet;
