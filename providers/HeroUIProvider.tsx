import { HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider config={config}>{children}</HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
