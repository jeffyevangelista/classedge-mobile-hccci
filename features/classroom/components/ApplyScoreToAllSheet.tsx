import { useCallback, useState } from "react";
import { Keyboard, View } from "react-native";
import { Button, Dialog, Input } from "heroui-native";
import { AppText } from "@/components/AppText";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  maxScore: number;
  onApply: (score: string) => void;
};

export const ApplyScoreToAllSheet = ({
  isOpen,
  onOpenChange,
  maxScore,
  onApply,
}: Props) => {
  const [defaultScore, setDefaultScore] = useState("");

  const isOverMax =
    defaultScore !== "" && parseInt(defaultScore, 10) > maxScore;

  const handleApply = useCallback(() => {
    if (defaultScore === "") return;
    const num = parseInt(defaultScore, 10);
    if (isNaN(num) || num < 0 || num > maxScore) return;
    onApply(defaultScore);
    setDefaultScore("");
    Keyboard.dismiss();
    onOpenChange(false);
  }, [defaultScore, maxScore, onApply, onOpenChange]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-md mx-auto">
          <View className="gap-4">
            <View className="gap-1">
              <Dialog.Title>Apply score to all</Dialog.Title>
              <Dialog.Description>
                Overwrites every student's score with the value below.
              </Dialog.Description>
            </View>

            <View className="flex-row items-center gap-2">
              <Input
                placeholder="0"
                value={defaultScore}
                onChangeText={(text: string) => {
                  if (text !== "" && !/^\d+$/.test(text)) return;
                  setDefaultScore(text);
                }}
                keyboardType="numeric"
                maxLength={String(maxScore).length}
                className={`w-24 text-center ${isOverMax ? "border-red-500" : ""}`}
              />
              <AppText className="text-sm text-foreground/70">
                / {maxScore}
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
                isDisabled={defaultScore === "" || isOverMax}
              >
                Apply to all
              </Button>
            </View>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ApplyScoreToAllSheet;
