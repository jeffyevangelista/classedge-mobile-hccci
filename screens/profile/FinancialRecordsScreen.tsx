import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Screen from "@/components/screen";
import { View } from "react-native";

const FinancialRecordsScreen = () => {
  return (
    <Screen>
      <View className="flex-1 justify-center items-center">
        <View className="gap-5 items-center">
          <View className="p-5 rounded-full bg-accent-soft">
            <Icon name="HammerIcon" size={75} className="text-accent" />
          </View>
          <AppText>Feature under construction</AppText>
        </View>
      </View>
    </Screen>
  );
};

export default FinancialRecordsScreen;
