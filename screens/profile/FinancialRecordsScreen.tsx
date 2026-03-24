import { AppText } from "@/components/AppText";
import EmptyState from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import Screen from "@/components/screen";
import { View } from "react-native";

const FinancialRecordsScreen = () => {
  return (
    <Screen>
      <View className="flex-1 justify-center items-center">
        <EmptyState
          icon="HammerIcon"
          title="Feature under construction"
          description="This feature is currently being developed and will be available soon."
        />
      </View>
    </Screen>
  );
};

export default FinancialRecordsScreen;
