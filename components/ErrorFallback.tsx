import Fallback from "./Fallback";

interface ErrorFallbackProps {
  message?: string;
  onRefetch?: () => void;
}

// Thin shim — delegates to the unified `<Fallback>` so every legacy
// call site picks up the new visual language without changes. New code
// should use `<Fallback variant="error" …>` directly.
const ErrorFallback = ({ message, onRefetch }: ErrorFallbackProps) => (
  <Fallback
    variant="error"
    description={message}
    action={onRefetch ? { label: "Try again", onPress: onRefetch } : undefined}
  />
);

export default ErrorFallback;
