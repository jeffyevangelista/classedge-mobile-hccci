import { env } from "@/utils/env";
import { useEffect } from "react";
import { OneSignal, LogLevel } from "react-native-onesignal";
import Constants from "expo-constants";

const OneSignalProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const appId = Constants.expoConfig?.extra?.onesignalAppId;

    if (!appId) {
      console.warn("OneSignal App ID not configured in app.json");
      return;
    }
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(appId);
    OneSignal.Notifications.requestPermission(true);
  }, []);

  return <>{children}</>;
};

export default OneSignalProvider;
