import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useThemeColor } from "heroui-native";

export const AssessmentClassroomBanner = () => {
  const accentColor = useThemeColor("accent");
  return (
    <View className="rounded-xl bg-accent-soft p-4 flex-row items-start gap-3">
      <View className="mt-0.5">
        <Icon name="ChalkboardTeacherIcon" size={20} color={accentColor} />
      </View>
      <View className="flex-1">
        <AppText weight="semibold" className="text-sm text-accent mb-1">
          In-class activity
        </AppText>
        <AppText className="text-xs text-muted">
          Your teacher will score this in class. No submission is needed from
          this device.
        </AppText>
      </View>
    </View>
  );
};
