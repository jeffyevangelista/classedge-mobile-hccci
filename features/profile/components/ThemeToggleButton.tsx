import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { Switch } from "heroui-native";
import { Pressable, View } from "react-native";
import { Uniwind, useUniwind } from "uniwind";

const ThemeToggleButton = () => {
  const { theme } = useUniwind();
  const isDark = theme === "dark";

  const toggle = () => {
    Uniwind.setTheme(isDark ? "light" : "dark");
  };

  return (
    <Pressable className="active:opacity-70" onPress={toggle}>
      <View className="flex-row items-center p-3 rounded-2xl border border-transparent">
        <Icon
          name={isDark ? "MoonIcon" : "SunIcon"}
          size={28}
          className="text-accent"
        />
        <AppText
          weight="semibold"
          className="text-base sm:text-lg ml-4 flex-1 text-slate-800 dark:text-slate-100"
        >
          Dark Mode
        </AppText>
        <Switch isSelected={isDark} onSelectedChange={toggle} />
      </View>
    </Pressable>
  );
};

export default ThemeToggleButton;
