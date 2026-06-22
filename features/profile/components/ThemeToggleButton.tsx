import { useEffect, useState } from "react";
import { View } from "react-native";
import { Uniwind } from "uniwind";
import { AppText } from "@/components/AppText";
import type { IconName } from "@/components/Icon";
import { getASItem, setASItem } from "@/lib/storage/async-storage";
import { ASYNC_STORAGE_KEYS } from "@/utils/storage-keys";
import ProfileRow from "./ProfileRow";

type ThemePreference = "light" | "dark" | "system";

const PREFERENCE_META: Record<
  ThemePreference,
  { label: string; icon: IconName; next: ThemePreference }
> = {
  light: { label: "Light", icon: "SunIcon", next: "dark" },
  dark: { label: "Dark", icon: "MoonIcon", next: "system" },
  system: { label: "System", icon: "DesktopIcon", next: "light" },
};

const ThemeToggleButton = () => {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    (async () => {
      const stored = await getASItem<ThemePreference>(
        ASYNC_STORAGE_KEYS.THEME_PREFERENCE,
      );
      if (stored && PREFERENCE_META[stored]) {
        setPreference(stored);
        Uniwind.setTheme(stored);
      }
    })();
  }, []);

  const cycle = () => {
    const next = PREFERENCE_META[preference].next;
    setPreference(next);
    Uniwind.setTheme(next);
    void setASItem(ASYNC_STORAGE_KEYS.THEME_PREFERENCE, next);
  };

  const meta = PREFERENCE_META[preference];

  return (
    <ProfileRow
      icon={meta.icon}
      label="Appearance"
      onPress={cycle}
      accessibilityRole="button"
      accessibilityLabel={`Appearance, currently ${meta.label}. Tap to change.`}
      trailing={
        <View className="px-2.5 py-0.5 rounded-full bg-accent-soft">
          <AppText weight="semibold" className="text-xs text-accent">
            {meta.label}
          </AppText>
        </View>
      }
    />
  );
};

export default ThemeToggleButton;
