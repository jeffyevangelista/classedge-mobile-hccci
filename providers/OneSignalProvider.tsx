import useStore from "@/lib/store";
import { useEffect } from "react";
import { OneSignal, LogLevel } from "react-native-onesignal";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

const OneSignalProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const authUser = useStore((state) => state.authUser);

  useEffect(() => {
    const appId = Constants.expoConfig?.extra?.onesignalAppId;

    if (!appId) {
      console.warn("OneSignal App ID not configured in app.json");
      return;
    }
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(appId);
    OneSignal.Notifications.requestPermission(true);

    const clickHandler = (event: any) => {
      const data = event.notification.additionalData;

      // Check if our custom path exists in the notification data
      if (data && data.path) {
        console.log("Redirecting to path:", data.path);

        // Use your navigation library to redirect the user
        router.push(data.path);
      }
    };

    OneSignal.Notifications.addEventListener("click", clickHandler);

    return () => {
      OneSignal.Notifications.removeEventListener("click", clickHandler);
    };
  }, []);

  useEffect(() => {
    if (authUser?.id) {
      OneSignal.login(String(authUser.id));
    } else {
      OneSignal.logout();
    }
  }, [authUser]);

  return <>{children}</>;
};

export default OneSignalProvider;
