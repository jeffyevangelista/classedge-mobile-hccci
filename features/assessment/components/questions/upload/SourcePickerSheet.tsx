import { BottomSheet, useThemeColor } from "heroui-native";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

export type UploadSource = "camera" | "library" | "document";

// Color identity per source mirrors AttachmentImageCard / AttachmentPdfCard
// so the visual mapping (image=teal, PDF=red) stays consistent between the
// picker, the filled upload card, and the review surfaces. Camera gets
// blue since it's a capture action distinct from "pick an existing image."
interface Row {
  source: UploadSource;
  icon: IconName;
  label: string;
  subtitle: string;
  tileClass: string;
  iconColor: string;
}

const ROWS: Row[] = [
  {
    source: "camera",
    icon: "Camera",
    label: "Take photo",
    subtitle: "Use the camera for a quick capture",
    tileClass: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "#0284c7",
  },
  {
    source: "library",
    icon: "Image",
    label: "Choose from gallery",
    subtitle: "Pick an existing photo",
    tileClass: "bg-teal-100 dark:bg-teal-900/50",
    iconColor: "#0d9488",
  },
  {
    source: "document",
    icon: "FilePdfIcon",
    label: "Pick a PDF",
    subtitle: "From Files, Drive, or Downloads",
    tileClass: "bg-red-100 dark:bg-red-900/50",
    iconColor: "#ef4444",
  },
];

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (source: UploadSource) => void;
}

export const SourcePickerSheet = ({ isOpen, onOpenChange, onPick }: Props) => {
  const mutedColor = useThemeColor("muted");
  const handlePick = (source: UploadSource) => {
    onOpenChange(false);
    onPick(source);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["35%"]} enableDynamicSizing={false}>
          <View className="px-4 pt-2 pb-6">
            <AppText
              weight="semibold"
              className="text-[10px] uppercase tracking-widest text-muted text-center mb-3"
            >
              Photo or PDF · Up to 25 MB
            </AppText>
            {ROWS.map((r, idx) => (
              <Pressable
                key={r.source}
                onPress={() => handlePick(r.source)}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                className={`flex-row items-center gap-3 py-3 active:opacity-70 ${
                  idx < ROWS.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-xl items-center justify-center ${r.tileClass}`}
                >
                  <Icon name={r.icon} size={20} color={r.iconColor} />
                </View>
                <View className="flex-1">
                  <AppText
                    weight="semibold"
                    className="text-[15px] text-foreground"
                  >
                    {r.label}
                  </AppText>
                  <AppText className="text-[11.5px] text-muted mt-0.5">
                    {r.subtitle}
                  </AppText>
                </View>
                <Icon name="CaretRightIcon" size={14} color={mutedColor} />
              </Pressable>
            ))}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};
