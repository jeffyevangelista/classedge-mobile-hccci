import { useStatus } from "@powersync/react-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";

const StreamList = () => {
  const status = useStatus();
  const streams = status.syncStreams ?? [];
  if (streams.length === 0) return null;

  const sorted = streams
    .slice()
    .sort(
      (a, b) =>
        (a.priority ?? 99) - (b.priority ?? 99) ||
        a.subscription.name.localeCompare(b.subscription.name),
    );

  const syncedCount = sorted.filter((s) => s.subscription.hasSynced).length;

  return (
    <View className="mt-3 gap-1.5">
      <View className="flex-row items-center justify-between">
        <AppText weight="semibold" className="text-xs uppercase text-gray-500">
          Sync streams
        </AppText>
        <AppText className="text-xs text-gray-500">
          {syncedCount}/{sorted.length} synced
        </AppText>
      </View>
      <View className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        {sorted.map((s) => {
          const key = `${s.subscription.name}:${JSON.stringify(s.subscription.parameters)}`;
          const synced = s.subscription.hasSynced;
          return (
            <View
              key={key}
              className="flex-row items-center justify-between px-3 py-1.5"
            >
              <AppText className="flex-1 text-xs">
                {s.subscription.name}
              </AppText>
              <AppText className="text-[10px] text-gray-500">
                p{s.priority ?? "?"}
              </AppText>
              <View
                className={`ml-2 rounded-full px-2 py-0.5 ${
                  synced ? "bg-success-soft" : "bg-warning-soft"
                }`}
              >
                <AppText
                  weight="semibold"
                  className={`text-[10px] ${
                    synced ? "text-success" : "text-warning"
                  }`}
                >
                  {synced ? "synced" : "pending"}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default StreamList;
