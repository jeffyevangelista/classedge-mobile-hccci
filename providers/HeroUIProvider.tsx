import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUniwind } from "uniwind";

const config: HeroUINativeConfig = {
  devInfo: {
    stylingPrinciples: false,
  },
  toast: {
    defaultProps: {
      placement: "top",
    },
  },
};

export default function HeroUIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useUniwind();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider config={config}>
        <ThemeProvider value={theme === "dark" ? DarkTheme : DefaultTheme}>
          {children}
          <StatusBar style="auto" />
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
