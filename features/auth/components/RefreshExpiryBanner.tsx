import { AppText } from "@/components/AppText";
import { useRefreshExpiry } from "@/features/auth/refreshExpiry";
import { captureAuthMessage } from "@/lib/telemetry";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const RefreshExpiryBanner = () => {
  const { shouldShowBanner, state, daysRemaining } = useRefreshExpiry();
  const insets = useSafeAreaInsets();
  const reportedRef = useRef(false);

  useEffect(() => {
    if (shouldShowBanner && !reportedRef.current) {
      captureAuthMessage("refresh_expiry_banner_shown", {
        state,
        daysRemaining,
      });
      reportedRef.current = true;
    }
    if (!shouldShowBanner) reportedRef.current = false;
  }, [shouldShowBanner, state, daysRemaining]);

  if (!shouldShowBanner) return null;

  const days = daysRemaining == null ? 0 : Math.ceil(daysRemaining);
  const isCritical = state === "critical";

  const message = isCritical
    ? "Your offline session expires today — reconnect to keep your unsynced changes."
    : `Your offline session expires in ${days} ${days === 1 ? "day" : "days"} — connect to keep working offline.`;

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: isCritical ? "#B45309" : "#D97706",
      }}
    >
      <View className="px-4 py-2">
        <AppText
          weight="semibold"
          className="text-xs"
          style={{ color: "#FFFFFF" }}
        >
          {message}
        </AppText>
      </View>
    </View>
  );
};

export default RefreshExpiryBanner;
