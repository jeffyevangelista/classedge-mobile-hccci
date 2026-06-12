import { View } from "react-native";
import { AppText } from "@/components/AppText";

export type SaveState = "idle" | "editing" | "saved";

interface Props {
  state: SaveState;
}

/**
 * Small dot + label that mirrors the parent QuestionList's 250ms debounced
 * save. "Editing" while the user is actively focused/typing, "Saved" once
 * the value has rested long enough that the parent has flushed it. The
 * indicator is best-effort: it doesn't observe the actual save result, so
 * "Saved" means "the change should be on disk by now" — true in the
 * common case, and the parent retries failures separately.
 */
export const SaveIndicator = ({ state }: Props) => {
  if (state === "idle") {
    // Reserve the row height so the meta row doesn't jump when the
    // indicator appears for the first time.
    return <View className="h-3" />;
  }
  const isSaved = state === "saved";
  return (
    <View className="flex-row items-center gap-1">
      <View
        className={`w-1.5 h-1.5 rounded-full ${
          isSaved ? "bg-success" : "bg-muted"
        }`}
      />
      <AppText
        weight="semibold"
        className={`text-[11px] ${isSaved ? "text-success" : "text-muted"}`}
      >
        {isSaved ? "Saved" : "Editing"}
      </AppText>
    </View>
  );
};
