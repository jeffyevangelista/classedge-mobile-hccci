import * as WebBrowser from "expo-web-browser";
import { useThemeColor } from "heroui-native";
import { Pressable, View } from "react-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

interface Props {
  url: string;
  /**
   * Optional human-friendly label to render in place of the URL. Falls
   * back to the URL with the scheme and trailing slash stripped.
   */
  label?: string;
}

// Shared link tile — accent chip + label/URL + open-in-browser arrow.
// Used wherever an external link is surfaced inside a detail screen
// (material details, lesson details, activity details).
export const LinkCard = ({ url, label }: Props) => {
  const display = label || url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");

  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(url)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${display}`}
      accessibilityHint="Opens in browser"
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="flex-row items-center gap-3 bg-default rounded-xl px-4 py-3 active:opacity-70"
    >
      <View className="w-10 h-10 rounded-lg bg-accent-soft items-center justify-center shrink-0">
        <Icon name="LinkIcon" size={20} color={accentColor} />
      </View>
      <AppText numberOfLines={2} className="flex-1 text-accent text-sm">
        {display}
      </AppText>
      <Icon name="ArrowSquareOutIcon" size={16} color={mutedColor} />
    </Pressable>
  );
};

export default LinkCard;
