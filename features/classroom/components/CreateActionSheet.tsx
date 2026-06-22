import { BottomSheet, useThemeColor } from "heroui-native";
import { useCallback, useMemo } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

const BOTTOM_SHEET_MAX_WIDTH = 768;

export type CreateAction = {
  key: string;
  icon: IconName;
  label: string;
  description: string;
  onPress: () => void;
};

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CreateAction[];
};

// Action sheet for the classroom header "+" button. Lists every create
// flow available in this classroom. Mirrors the chrome / row layout of
// ImageSourceSheet + ImageActionSheet so the sheet vocabulary stays
// uniform across the app.
export const CreateActionSheet = ({ isOpen, onOpenChange, actions }: Props) => {
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

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

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
              Create new
            </AppText>
            <AppText className="text-xs text-muted mb-3">
              What would you like to add to this class?
            </AppText>

            {actions.map((action) => (
              <ActionRow
                key={action.key}
                icon={action.icon}
                label={action.label}
                description={action.description}
                tint={accentColor}
                onPress={close(action.onPress)}
              />
            ))}

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

const ActionRow = ({
  icon,
  label,
  description,
  tint,
  onPress,
}: {
  icon: IconName;
  label: string;
  description: string;
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
    <View className="w-12 h-12 rounded-xl bg-accent-soft items-center justify-center">
      <Icon name={icon} size={22} color={tint} />
    </View>
    <View className="flex-1">
      <AppText weight="semibold" className="text-sm text-foreground">
        {label}
      </AppText>
      <AppText className="text-xs text-muted mt-0.5">{description}</AppText>
    </View>
  </Pressable>
);

export default CreateActionSheet;
