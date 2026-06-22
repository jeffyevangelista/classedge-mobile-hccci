import Fallback from "./Fallback";
import type { IconName } from "./Icon";

interface NoDataFallbackProps {
  icon?: IconName;
  title?: string;
  description?: string;
  onRefetch?: () => void;
}

// Thin shim — delegates to the unified `<Fallback>` so every legacy
// call site picks up the new visual language without changes. New code
// should use `<Fallback variant="empty" …>` directly.
const NoDataFallback = ({
  icon,
  title,
  description,
  onRefetch,
}: NoDataFallbackProps) => (
  <Fallback
    variant="empty"
    icon={icon}
    title={title}
    description={description}
    action={onRefetch ? { label: "Refresh", onPress: onRefetch } : undefined}
  />
);

export default NoDataFallback;
