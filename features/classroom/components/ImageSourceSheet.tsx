import { useCallback, useMemo } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

const BOTTOM_SHEET_MAX_WIDTH = 768;

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
};

export const ImageSourceSheet = ({
  isOpen,
  onOpenChange,
  onPickCamera,
  onPickLibrary,
}: Props) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");

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

  const handleCamera = useCallback(() => {
    onOpenChange(false);
    onPickCamera();
  }, [onOpenChange, onPickCamera]);

  const handleLibrary = useCallback(() => {
    onOpenChange(false);
    onPickLibrary();
  }, [onOpenChange, onPickLibrary]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

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
              Attach an image
            </AppText>
            <AppText className="text-xs text-muted mb-3">
              Add a photo of the score sheet or graded work for this
              student.
            </AppText>

            <SourceOption
              icon="CameraIcon"
              label="Take photo"
              description="Capture with the device camera"
              accentColor={accentColor}
              onPress={handleCamera}
            />
            <SourceOption
              icon="ImageSquareIcon"
              label="Choose from library"
              description="Pick from your saved photos"
              accentColor={accentColor}
              onPress={handleLibrary}
            />

            <Pressable
              onPress={handleCancel}
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

const SourceOption = ({
  icon,
  label,
  description,
  accentColor,
  onPress,
}: {
  icon: IconName;
  label: string;
  description: string;
  accentColor: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
    className="flex-row items-center gap-3 py-2 px-2 rounded-xl active:opacity-80"
  >
    <View className="w-12 h-12 rounded-xl bg-accent-soft items-center justify-center">
      <Icon name={icon} size={22} color={accentColor} />
    </View>
    <View className="flex-1">
      <AppText weight="semibold" className="text-sm text-foreground">
        {label}
      </AppText>
      <AppText className="text-xs text-muted mt-0.5">{description}</AppText>
    </View>
  </Pressable>
);

export default ImageSourceSheet;
