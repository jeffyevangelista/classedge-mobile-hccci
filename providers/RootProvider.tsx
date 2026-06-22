import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NetworkBannerProvider } from "@/features/network/NetworkBannerContext";
import { startActivityTracker } from "@/lib/activity-tracker";
import { NavListener } from "@/lib/activity-tracker/NavListener";
import HeroUIProvider from "./HeroUIProvider";
import ImageProvider from "./ImageProvider";
import KeyboardProvider from "./KeyboardProvider";
import NetworkProvider from "./NetworkProvider";
import OneSignalProvider from "./OneSignalProvider";
import PowerSyncProvider from "./PowerSyncProvider";
import QueryProvider from "./QueryProvider";

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const stop = startActivityTracker();
    return stop;
  }, []);

  return (
    <SafeAreaProvider>
      <ImageProvider>
        <OneSignalProvider>
          <NetworkProvider>
            <NetworkBannerProvider>
              <PowerSyncProvider>
                <QueryProvider>
                  <HeroUIProvider>
                    <KeyboardProvider>
                      <NavListener />
                      {children}
                    </KeyboardProvider>
                  </HeroUIProvider>
                </QueryProvider>
              </PowerSyncProvider>
            </NetworkBannerProvider>
          </NetworkProvider>
        </OneSignalProvider>
      </ImageProvider>
    </SafeAreaProvider>
  );
};

export default RootProvider;
