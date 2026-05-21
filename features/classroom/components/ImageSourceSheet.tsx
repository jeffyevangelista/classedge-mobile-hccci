import { useCallback, useMemo } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 0,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
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

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          enableDynamicSizing
          topInset={Math.max(insets.top, 16)}
          style={contentStyle}
          className="bg-overlay"
        >
          <View className="px-5 pt-2 pb-6 gap-2">
            <AppText weight="semibold" className="text-base mb-2">
              Attach Image
            </AppText>

            <Pressable
              onPress={handleCamera}
              className="flex-row items-center gap-3 py-3 px-3 rounded-xl active:bg-default-100"
            >
              <Icon name="Camera" size={22} />
              <AppText className="text-base">Take Photo</AppText>
            </Pressable>

            <Pressable
              onPress={handleLibrary}
              className="flex-row items-center gap-3 py-3 px-3 rounded-xl active:bg-default-100"
            >
              <Icon name="ImageSquare" size={22} />
              <AppText className="text-base">Choose from Library</AppText>
            </Pressable>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

export default ImageSourceSheet;
