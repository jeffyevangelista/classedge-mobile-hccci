import Fallback from "./Fallback";

interface ErrorComponentProps {
  message: string;
  onRetry?: () => void;
}

// Thin shim — delegates to the unified `<Fallback>` so every legacy
// call site picks up the new visual language without changes. New code
// should use `<Fallback variant="error" …>` directly.
export function ErrorComponent({ message, onRetry }: ErrorComponentProps) {
  return (
    <Fallback
      variant="error"
      description={message}
      action={onRetry ? { label: "Try again", onPress: onRetry } : undefined}
    />
  );
}
