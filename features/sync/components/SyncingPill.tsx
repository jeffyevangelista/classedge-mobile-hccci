import { useStatus } from "@powersync/react-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";

type Props = {
  /** The priority level this pill represents. Pill is visible while
   *  the given priority has not yet finished its first sync.
   *
   *  Note: Per `@powersync/common` SyncStatus.statusForPriority, when no
   *  priority entries are reported by the backend it falls back to the
   *  overall `hasSynced` — so this pill is safe to use before priorities
   *  are deployed in sync-rules.yaml; it will simply render during the
   *  initial full sync. */
  priority: number;
  /** Optional label override. Defaults to "Syncing…" */
  label?: string;
};

export const SyncingPill = ({ priority, label = "Syncing…" }: Props) => {
  const status = useStatus();
  const synced = status.statusForPriority(priority).hasSynced === true;
  if (synced) return null;

  return (
    <View className="self-start rounded-full bg-warning-soft px-2 py-0.5">
      <AppText weight="semibold" className="text-[10px] text-warning">
        {label}
      </AppText>
    </View>
  );
};

export default SyncingPill;
