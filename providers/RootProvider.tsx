import { SafeAreaProvider } from "react-native-safe-area-context";
import { NetworkBannerProvider } from "@/features/network/NetworkBannerContext";
import HeroUIProvider from "./HeroUIProvider";
import KeyboardProvider from "./KeyboardProvider";
import NetworkProvider from "./NetworkProvider";
import PowerSyncProvider from "./PowerSyncProvider";
import QueryProvider from "./QueryProvider";

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <NetworkBannerProvider>
          <PowerSyncProvider>
            <QueryProvider>
              <HeroUIProvider>
                <KeyboardProvider>{children}</KeyboardProvider>
              </HeroUIProvider>
            </QueryProvider>
          </PowerSyncProvider>
        </NetworkBannerProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
};

export default RootProvider;
