import { ScrollView, type ScrollViewProps } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

/**
 * ScrollView wrapper that pads the content container's bottom by the
 * safe-area inset (home indicator / Android nav). The scroll viewport
 * extends to the screen edge — the last item rests above the system
 * gesture area (iOS-native pattern).
 *
 * For `Animated.ScrollView` (parallax screens), don't use this — keep the
 * Animated.ScrollView and apply
 * `contentContainerStyle={{ paddingBottom: useScrollBottomInset() }}`
 * inline.
 *
 * Caller-provided `contentContainerStyle` merges after our paddingBottom
 * (caller wins). Don't set `pb-*` in `contentContainerClassName` unless
 * you want to override the safe-area padding entirely.
 */
export function ScreenScrollView(props: ScrollViewProps) {
  const paddingBottom = useScrollBottomInset();
  return (
    <ScrollView
      {...props}
      contentContainerStyle={[
        { paddingBottom },
        props.contentContainerStyle,
      ]}
    />
  );
}
