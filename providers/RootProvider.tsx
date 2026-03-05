import { SafeAreaProvider } from "react-native-safe-area-context";
import HeroUIProvider from "./HeroUIProvider";
import KeyboardProvider from "./KeyboardProvider";
import PowerSyncProvider from "./PowerSyncProvider";
import QueryProvider from "./QueryProvider";

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SafeAreaProvider>
      <PowerSyncProvider>
        <QueryProvider>
          <HeroUIProvider>
            <KeyboardProvider>{children}</KeyboardProvider>
          </HeroUIProvider>
        </QueryProvider>
      </PowerSyncProvider>
    </SafeAreaProvider>
  );
};

export default RootProvider;
