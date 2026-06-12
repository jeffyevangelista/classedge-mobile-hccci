import Fallback from "./Fallback";
import type { IconName } from "./Icon";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
}

// Thin shim — delegates to the unified `<Fallback>` so every legacy
// call site picks up the new visual language without changes. New code
// should use `<Fallback variant="empty" …>` directly.
const EmptyState = ({ icon, title, description }: EmptyStateProps) => (
  <Fallback
    variant="empty"
    icon={icon}
    title={title}
    description={description}
  />
);

export default EmptyState;
