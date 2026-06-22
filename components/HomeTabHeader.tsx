import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import HeaderDecor from "@/features/home/components/HeaderDecor";
import SyncCenter from "@/features/sync/components/SyncCenter";

const HomeTabHeader = () => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-surface px-5 pb-3 overflow-hidden flex flex-row justify-between items-center"
    >
      <HeaderDecor />
      <View className="flex flex-row items-center gap-3">
        <Image
          source={require("@/assets/logo.png")}
          style={{ width: 44, height: 44 }}
          contentFit="contain"
        />
        <AppText weight="semibold" className="text-sm text-muted">
          HCCCI
        </AppText>
      </View>
      <SyncCenter />
    </View>
  );
};

export default HomeTabHeader;
