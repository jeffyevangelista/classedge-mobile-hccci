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

      if (data && data.entity_type && data.entity_id) {
        const { entity_type, entity_id, notification_id } = data;

        // Mark notification as read if notification_id is available
        if (notification_id) {
          readNotification(String(notification_id)).catch((err: any) =>
            console.log("Failed to mark notification as read:", err.message),
          );
        }

        // Route based on entity_type, matching NotificationList logic
        const path =
          entity_type === "lesson" || entity_type === "module"
            ? `/material/${entity_id}`
            : `/assessment/${entity_id}`;

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
