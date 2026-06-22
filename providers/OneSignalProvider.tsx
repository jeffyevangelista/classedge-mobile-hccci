import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { LogLevel, OneSignal } from "react-native-onesignal";
import { enqueuePushAttachments } from "@/features/attachments/attachments.api";
import {
  getNotificationHref,
  readNotification,
} from "@/features/notifications/notifications.service";
import {
  makeEntityKey,
  setPushPayload,
} from "@/features/notifications/pushPayloadCache";
import useStore from "@/lib/store";

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

      if (data?.entityType && data.entityId) {
        const { entityType, entityId, notificationId, payload } = data;

        // Mark notification as read if notificationId is available
        if (notificationId) {
          readNotification(String(notificationId)).catch((err: any) => {
            if (__DEV__)
              console.log("Failed to mark notification as read:", err.message);
          });
        }

        // Stash the per-entity payload so the target detail screen can
        // hydrate from it on first paint while PowerSync catches up.
        // Backwards-compatible: pushes without a `payload` field skip this.
        if (payload != null) {
          setPushPayload(makeEntityKey(entityType, entityId), payload);

          // Pre-enqueue attachment downloads referenced in the payload
          // so the queue starts fetching before PowerSync replicates
          // the source row. Backwards-compatible: payloads without
          // `attachments` skip this and fall back to the watcher path.
          if (Array.isArray(payload.attachments)) {
            void enqueuePushAttachments(payload.attachments);
          }

          // Announcement payloads embed their associated events fully
          // (see logs/push_payloads.build_announcement_payload). Cache
          // each embedded event under its own entity key so that
          // tapping an event card from the announcement also hydrates
          // first-paint without waiting for PowerSync.
          if (entityType === "announcement" && Array.isArray(payload.events)) {
            for (const link of payload.events) {
              const nested = link?.event;
              if (nested?.id != null) {
                setPushPayload(makeEntityKey("event", nested.id), nested);
              }
            }
          }
        }

        const href = getNotificationHref(entityType, entityId);
        if (__DEV__) console.log("Redirecting to:", href);
        router.push(href);
      }
    };

    const foregroundWillDisplayHandler = (event: any) => {
      event.getNotification().display();
    };

    OneSignal.Notifications.addEventListener("click", clickHandler);
    OneSignal.Notifications.addEventListener(
      "foregroundWillDisplay",
      foregroundWillDisplayHandler,
    );

    return () => {
      OneSignal.Notifications.removeEventListener("click", clickHandler);
      OneSignal.Notifications.removeEventListener(
        "foregroundWillDisplay",
        foregroundWillDisplayHandler,
      );
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
