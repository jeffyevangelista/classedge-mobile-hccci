import { HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

const config: HeroUINativeConfig = {
  // Global text configuration
  // textProps: {
  //   minimumFontScale: 0.5,
  //   maxFontSizeMultiplier: 1.5,
  //   allowFontScaling: true,
  //   adjustsFontSizeToFit: false,
  // },
  // // Global animation configuration
  // animation: "disable-all", // Optional: disable all animations
  // Developer information messages configuration
  devInfo: {
    stylingPrinciples: false, // Optional: disable styling principles message
  },
  // Global toast configuration
  // toast: {
  //   defaultProps: {
  //     variant: "default",
  //     placement: "top",
  //   },
  //   insets: {
  //     top: 0,
  //     bottom: 6,
  //     left: 12,
  //     right: 12,
  //   },
  //   maxVisibleToasts: 3,
  // },
};

export default function HeroUIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider config={config}>{children}</HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
