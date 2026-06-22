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
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onRemove: () => void;
  canRemove: boolean;
};

export const ProfilePhotoActionSheet = ({
  isOpen,
  onOpenChange,
  onPickCamera,
  onPickLibrary,
  onRemove,
  canRemove,
}: Props) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 8,
    }),
    [screenWidth],
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleCamera = useCallback(() => {
    close();
    onPickCamera();
  }, [close, onPickCamera]);

  const handleLibrary = useCallback(() => {
    close();
    onPickLibrary();
  }, [close, onPickLibrary]);

  const handleRemove = useCallback(() => {
    close();
    onRemove();
  }, [close, onRemove]);

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
              Profile photo
            </AppText>
            <AppText className="text-xs text-muted mb-3">
              Change or remove the photo on your profile.
            </AppText>

            <SourceOption
              icon="CameraIcon"
              label="Take photo"
              description="Capture with the device camera"
              tone="accent"
              tint={accentColor}
              onPress={handleCamera}
            />
            <SourceOption
              icon="ImageSquareIcon"
              label="Choose from library"
              description="Pick from your saved photos"
              tone="accent"
              tint={accentColor}
              onPress={handleLibrary}
            />
            {canRemove ? (
              <SourceOption
                icon="TrashIcon"
                label="Remove photo"
                description="Show your initials instead"
                tone="danger"
                tint={dangerColor}
                onPress={handleRemove}
              />
            ) : null}

            <Pressable
              onPress={close}
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
  tone,
  tint,
  onPress,
}: {
  icon: IconName;
  label: string;
  description: string;
  tone: "accent" | "danger";
  tint: string;
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
      className={`w-12 h-12 rounded-xl items-center justify-center ${tone === "danger" ? "bg-danger-soft" : "bg-accent-soft"}`}
    >
      <Icon name={icon} size={22} color={tint} />
    </View>
    <View className="flex-1">
      <AppText
        weight="semibold"
        className={`text-sm ${tone === "danger" ? "text-danger" : "text-foreground"}`}
      >
        {label}
      </AppText>
      <AppText className="text-xs text-muted mt-0.5">{description}</AppText>
    </View>
  </Pressable>
);

export default ProfilePhotoActionSheet;
