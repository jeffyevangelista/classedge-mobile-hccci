import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";

type Options = {
  /**
   * When true, the header background matches the page background and the
   * bottom border is removed — the header dissolves into the content. Use on
   * screens with no title where the header is just hosting the back button.
   */
  transparent?: boolean;
};

export const useThemedHeaderOptions = ({
  transparent = false,
}: Options = {}) => {
  const surfaceColor = useThemeColor("surface");
  const backgroundColor = useThemeColor("background");
  const foregroundColor = useThemeColor("foreground");
  const borderColor = useThemeColor("border");

  return {
    headerStyle: {
      backgroundColor: transparent ? backgroundColor : surfaceColor,
      borderBottomColor: transparent ? "transparent" : borderColor,
      borderBottomWidth: transparent ? 0 : 1,
    },
    headerTintColor: foregroundColor,
    headerTitle: ({ children }: { children?: string }) => (
      <AppText
        weight="semibold"
        numberOfLines={1}
        style={{
          fontSize: 18,
          color: foregroundColor,
          textAlignVertical: "center",
        }}
      >
        {children ?? ""}
      </AppText>
    ),
    headerShadowVisible: false,
  };
};
