import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from "@shopify/flash-list";
import type { Ref } from "react";
import { StyleSheet } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

/**
 * FlashList wrapper that pads the content container's bottom by the
 * safe-area inset (Android nav bar / iOS home indicator). The scroll
 * viewport extends to the screen edge — the last item rests above the
 * system gesture area (iOS-native pattern).
 *
 * Caller-provided `contentContainerStyle` merges after our paddingBottom
 * (caller wins). Accepts an optional `ref` forwarded to the underlying
 * FlashList.
 */
export function ScreenList<T>(
  props: FlashListProps<T> & { ref?: Ref<FlashListRef<T>> },
) {
  const paddingBottom = useScrollBottomInset();
  return (
    <FlashList
      {...props}
      contentContainerStyle={StyleSheet.flatten([
        { paddingBottom },
        props.contentContainerStyle,
      ])}
    />
  );
}
