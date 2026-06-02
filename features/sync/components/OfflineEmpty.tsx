// features/sync/components/OfflineEmpty.tsx

import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useThemeColor } from "heroui-native";
import { offlineCopy, type OfflineSection } from "../offlineCopy";

type Props = {
  section: OfflineSection;
};

export const OfflineEmpty = ({ section }: Props) => {
  const mutedColor = useThemeColor("muted");
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <Icon name="CloudSlashIcon" size={40} color={mutedColor} />
      <AppText weight="semibold" className="text-base text-center">
        {offlineCopy[section]}
      </AppText>
      <AppText className="text-xs text-muted text-center">
        We'll sync this automatically when you're back online.
      </AppText>
    </View>
  );
};

export default OfflineEmpty;
