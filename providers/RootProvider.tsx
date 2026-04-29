import { SafeAreaProvider } from "react-native-safe-area-context";
import { NetworkBannerProvider } from "@/features/network/NetworkBannerContext";
import HeroUIProvider from "./HeroUIProvider";
import KeyboardProvider from "./KeyboardProvider";
import NetworkProvider from "./NetworkProvider";
import PowerSyncProvider from "./PowerSyncProvider";
import OneSignalProvider from "./OneSignalProvider";
import QueryProvider from "./QueryProvider";
import ImageProvider from "./ImageProvider";

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SafeAreaProvider>
      <ImageProvider>
        <OneSignalProvider>
          <NetworkProvider>
            <NetworkBannerProvider>
              <QueryProvider>
                <PowerSyncProvider>
                  <HeroUIProvider>
                    <KeyboardProvider>{children}</KeyboardProvider>
                  </HeroUIProvider>
                </PowerSyncProvider>
              </QueryProvider>
            </NetworkBannerProvider>
          </NetworkProvider>
        </OneSignalProvider>
      </ImageProvider>
    </SafeAreaProvider>
  );
};

export default RootProvider;
