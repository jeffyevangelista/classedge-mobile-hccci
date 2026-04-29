import { ActivityIndicator, View } from "react-native";
import { useStatus } from "@powersync/react-native";
import { AppText } from "@/components/AppText";

export const SyncSplash = () => {
  const status = useStatus();
  const { connected, connecting, syncStreams } = status;

  const totalStreams = syncStreams?.length ?? 0;
  const syncedStreams =
    syncStreams?.filter((s) => s.subscription.hasSynced).length ?? 0;

  let primary = "Syncing your data…";
  let secondary: string | null = null;

  if (connecting) {
    primary = "Connecting…";
  } else if (!connected) {
    primary = "Waiting for connection";
    secondary = "Connect to the internet to finish loading your data.";
  } else if (totalStreams > 0) {
    secondary = `${syncedStreams} of ${totalStreams} streams ready`;
  }

  return (
    <View className="flex-1 items-center justify-center bg-background gap-4 p-6">
      <ActivityIndicator size="large" />
      <AppText weight="semibold" className="text-lg">
        {primary}
      </AppText>
      {secondary ? (
        <AppText className="text-center text-foreground/70">{secondary}</AppText>
      ) : null}
    </View>
  );
};

export default SyncSplash;
