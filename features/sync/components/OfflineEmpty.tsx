// features/sync/components/OfflineEmpty.tsx

import Fallback from "@/components/Fallback";
import { offlineCopy, type OfflineSection } from "../offlineCopy";

type Props = {
  section: OfflineSection;
};

// Thin shim — delegates to the unified `<Fallback>` so every legacy
// call site picks up the new visual language without changes. New code
// should use `<Fallback variant="offline" …>` directly.
export const OfflineEmpty = ({ section }: Props) => (
  <Fallback
    variant="offline"
    title={offlineCopy[section]}
    description="We'll sync this automatically when you're back online."
  />
);

export default OfflineEmpty;
