import useStore from "@/lib/store";
import { useEffect } from "react";
import { OneSignal, LogLevel } from "react-native-onesignal";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { readNotification } from "@/features/notifications/notifications.service";

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

      if (data && data.entityType && data.entityId) {
        const { entityType, entityId, notificationId } = data;

        // Mark notification as read if notificationId is available
        if (notificationId) {
          readNotification(String(notificationId)).catch((err: any) =>
            console.log("Failed to mark notification as read:", err.message),
          );
        }

        // Route based on entityType, matching NotificationList logic
        const path =
          entityType === "lesson" || entityType === "module"
            ? `/material/${entityId}`
            : `/assessment/${entityId}`;

        console.log("Redirecting to path:", path);
        router.push(path);
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
