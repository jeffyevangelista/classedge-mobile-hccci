// [push-hydrate verify] — remove this file after end-to-end verification.
// Inline dev-only pill that surfaces the hydration source for a detail
// screen so we can confirm push-payload → canonical replacement at a
// glance. Returns null in production builds.

import { View } from "react-native";
import { AppText } from "@/components/AppText";
import type { EntitySource } from "./useEntityFromPushOrSync";

const PALETTE: Record<EntitySource, { bg: string; fg: string }> = {
  payload: { bg: "bg-blue-200", fg: "text-blue-900" },
  local: { bg: "bg-green-200", fg: "text-green-900" },
  api: { bg: "bg-amber-200", fg: "text-amber-900" },
  none: { bg: "bg-neutral-300", fg: "text-neutral-700" },
};

type Props = {
  entityKey: string;
  source: EntitySource;
  isResolving: boolean;
  isMissing: boolean;
};

const HydrationDebugPill = ({
  entityKey,
  source,
  isResolving,
  isMissing,
}: Props) => {
  if (!__DEV__) return null;
  const { bg, fg } = PALETTE[source];
  const status = isResolving ? "resolving" : isMissing ? "missing" : "ready";
  return (
    <View className={`self-start px-2 py-0.5 rounded-full ${bg}`}>
      <AppText className={`text-[10px] ${fg}`}>
        {entityKey} · {source} · {status}
      </AppText>
    </View>
  );
};

export default HydrationDebugPill;
