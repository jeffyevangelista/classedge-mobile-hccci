import { useThemeColor } from "heroui-native";
import { View } from "react-native";

export const useThemedHeaderOptions = () => {
  const surfaceColor = useThemeColor("surface");
  const foregroundColor = useThemeColor("foreground");
  return {
    headerStyle: { backgroundColor: surfaceColor },
    headerTintColor: foregroundColor,
    headerTitleStyle: {
      color: foregroundColor,
      fontFamily: "Poppins-SemiBold",
    },
    headerShadowVisible: false,
    headerBackground: () => (
      <View className="flex-1 bg-surface border-b border-border" />
    ),
  };
};
