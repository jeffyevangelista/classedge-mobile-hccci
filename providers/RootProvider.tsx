import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NetworkBannerProvider } from "@/features/network/NetworkBannerContext";
import { startActivityTracker } from "@/lib/activity-tracker";
import { NavListener } from "@/lib/activity-tracker/NavListener";
import HeroUIProvider from "./HeroUIProvider";
import KeyboardProvider from "./KeyboardProvider";
import NetworkProvider from "./NetworkProvider";
import PowerSyncProvider from "./PowerSyncProvider";
import OneSignalProvider from "./OneSignalProvider";
import QueryProvider from "./QueryProvider";
import ImageProvider from "./ImageProvider";

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
