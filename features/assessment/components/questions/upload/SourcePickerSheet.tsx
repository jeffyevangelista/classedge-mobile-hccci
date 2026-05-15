import { Pressable, View } from "react-native";
import { BottomSheet, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

export type UploadSource = "camera" | "library" | "document";

interface Row {
  source: UploadSource;
  icon: IconName;
  label: string;
}

const ROWS: Row[] = [
  { source: "camera", icon: "Camera", label: "Take photo" },
  { source: "library", icon: "Image", label: "Choose from gallery" },
  { source: "document", icon: "File", label: "Pick document" },
];

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (source: UploadSource) => void;
}

export const SourcePickerSheet = ({ isOpen, onOpenChange, onPick }: Props) => {
  const foregroundColor = useThemeColor("foreground");
  const handlePick = (source: UploadSource) => {
    onOpenChange(false);
    onPick(source);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["35%"]}
          enableDynamicSizing={false}
          className="bg-overlay"
        >
          <View className="px-4 pt-2 pb-6">
            {ROWS.map((r, idx) => (
              <Pressable
                key={r.source}
                onPress={() => handlePick(r.source)}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                className={`flex-row items-center gap-3 py-4 ${
                  idx < ROWS.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <Icon name={r.icon} size={22} color={foregroundColor} />
                <AppText className="text-base">{r.label}</AppText>
              </Pressable>
            ))}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};
