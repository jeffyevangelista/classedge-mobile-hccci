import { useThemeColor } from "heroui-native";

export const useThemedHeaderOptions = () => {
  const surfaceColor = useThemeColor("surface");
  const foregroundColor = useThemeColor("foreground");
  const borderColor = useThemeColor("border");
  return {
    headerStyle: {
      backgroundColor: surfaceColor,
      borderBottomColor: borderColor,
      borderBottomWidth: 1,
    },
    headerTintColor: foregroundColor,
    headerTitleStyle: {
      color: foregroundColor,
      fontFamily: "Poppins-SemiBold",
    },
    headerShadowVisible: false,
  };
};
