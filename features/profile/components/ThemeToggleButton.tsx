import { Switch } from "heroui-native";
import { Uniwind, useUniwind } from "uniwind";
import ProfileRow from "./ProfileRow";

const ThemeToggleButton = () => {
  const { theme } = useUniwind();
  const isDark = theme === "dark";

  const toggle = () => {
    Uniwind.setTheme(isDark ? "light" : "dark");
  };

  return (
    <ProfileRow
      icon={isDark ? "MoonIcon" : "SunIcon"}
      label="Dark Mode"
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      trailing={<Switch isSelected={isDark} onSelectedChange={toggle} />}
    />
  );
};

export default ThemeToggleButton;
