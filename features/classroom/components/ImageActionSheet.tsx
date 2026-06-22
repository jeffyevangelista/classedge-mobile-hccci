import { BottomSheet, useThemeColor } from "heroui-native";
import { useCallback, useMemo } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

const BOTTOM_SHEET_MAX_WIDTH = 768;

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onView: () => void;
  onReplace: () => void;
  onDelete: () => void;
};

// Action menu for the score-row thumbnail: View opens the fullscreen
// viewer, Replace re-opens the source sheet (capture / library) to
// overwrite the existing image, Delete clears the attachment. Pulled
// into its own sheet so the tiny X badge on the thumbnail doesn't have
// to do double duty as the only management affordance.
export const ImageActionSheet = ({
  isOpen,
  onOpenChange,
  onView,
  onReplace,
  onDelete,
}: Props) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");

  const contentStyle = useMemo(
    () => ({
      // Inset from the screen edges so the sheet floats with breathing
      // room on both sides instead of spanning edge-to-edge. On tablets,
      // cap at `BOTTOM_SHEET_MAX_WIDTH` and center.
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 8,
    }),
    [screenWidth],
  );

  const close = useCallback(
    (after: () => void) => () => {
      onOpenChange(false);
      after();
    },
    [onOpenChange],
  );

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          enableDynamicSizing
          topInset={Math.max(insets.top, 16)}
          style={contentStyle}
        >
          <View className="px-5 pt-4 pb-6 gap-1">
            <AppText weight="bold" className="text-lg text-foreground">
              Attached image
            </AppText>
            <AppText className="text-xs text-muted mb-3">
              What would you like to do with this image?
            </AppText>

            <ActionRow
              icon="ArrowsOutIcon"
              label="View"
              description="Open the image full-screen"
              tint={accentColor}
              onPress={close(onView)}
            />
            <ActionRow
              icon="ArrowsClockwiseIcon"
              label="Replace"
              description="Capture or choose a different image"
              tint={accentColor}
              onPress={close(onReplace)}
            />
            <ActionRow
              icon="TrashIcon"
              label="Delete"
              description="Remove the attached image"
              tint={dangerColor}
              destructive
              onPress={close(onDelete)}
            />

            <Pressable
              onPress={() => onOpenChange(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
              className="mt-2 py-3 rounded-xl items-center active:opacity-70"
            >
              <AppText weight="semibold" className="text-sm text-muted">
                Cancel
              </AppText>
            </Pressable>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

const ActionRow = ({
  icon,
  label,
  description,
  tint,
  destructive = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  description: string;
  tint: string;
  destructive?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
    className="flex-row items-center gap-3 py-2 px-2 rounded-xl active:opacity-80"
  >
    <View
      className={`w-12 h-12 rounded-xl items-center justify-center ${
        destructive ? "bg-danger-soft" : "bg-accent-soft"
      }`}
    >
      <Icon name={icon} size={22} color={tint} />
    </View>
    <View className="flex-1">
      <AppText
        weight="semibold"
        className={`text-sm ${destructive ? "text-danger" : "text-foreground"}`}
      >
        {label}
      </AppText>
      <AppText className="text-xs text-muted mt-0.5">{description}</AppText>
    </View>
  </Pressable>
);

export default ImageActionSheet;
