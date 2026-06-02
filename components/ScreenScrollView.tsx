import { ScrollView, type ScrollViewProps } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

/**
 * ScrollView wrapper that shrinks the scroll viewport from the bottom by the
 * combined safe-area inset plus network banner height plus 16px. Mid-scroll
 * content never appears under the system nav bar.
 *
 * For `Animated.ScrollView` (parallax screens), don't use this — keep the
 * Animated.ScrollView and apply `style={{ marginBottom: useScrollBottomInset(16) }}`
 * inline.
 *
 * Caller-provided `style` is merged after the marginBottom (caller wins).
 */
export function ScreenScrollView(props: ScrollViewProps) {
  const marginBottom = useScrollBottomInset();
  return (
    <ScrollView
      {...props}
      style={[{ marginBottom }, props.style]}
    />
  );
}
