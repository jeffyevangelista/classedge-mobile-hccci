import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from "@shopify/flash-list";
import type { Ref } from "react";
import { StyleSheet } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

/**
 * FlashList wrapper that shrinks the scroll viewport from the bottom by the
 * combined safe-area inset (Android nav bar / iOS home indicator) plus network
 * banner height plus 16px breathing room. Mid-scroll content never appears
 * underneath the system nav bar — the area below the scroll viewport shows
 * the parent's background instead.
 *
 * Caller-provided `style` is merged after the marginBottom (caller wins).
 * Accepts an optional `ref` forwarded to the underlying FlashList.
 */
export function ScreenList<T>(
  props: FlashListProps<T> & { ref?: Ref<FlashListRef<T>> },
) {
  const marginBottom = useScrollBottomInset();
  return (
    <FlashList
      {...props}
      style={StyleSheet.flatten([{ marginBottom }, props.style])}
    />
  );
}
