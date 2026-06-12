import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/AppText";

const DEFAULT_COLLAPSED_LINES = 4;

interface Props {
  /** Body text to render. */
  text: string;
  /**
   * When false, the body is always rendered fully and no toggle appears —
   * use this for cases where the body IS the content (e.g. a description
   * with no other payload below it). Defaults to true.
   */
  canCollapse?: boolean;
  /** Lines shown when collapsed. Defaults to 4. */
  collapsedLines?: number;
  /**
   * className applied to the body `AppText`. Allows callers to choose
   * `text-sm` vs `text-base` etc. while keeping the collapse logic in one
   * place. Defaults to `text-foreground leading-relaxed`.
   */
  textClassName?: string;
  /**
   * Accessibility verbs used in the labels — keeps screen readers concise
   * and context-appropriate. Defaults to "description".
   */
  noun?: string;
}

/**
 * Collapsible body text that decides whether to clamp by comparing the
 * height of two offscreen `onLayout` twins — one clamped to `collapsedLines`,
 * one unclamped. If the unclamped twin is taller, the text overflows.
 *
 * Why not `onTextLayout`? It returns an empty `lines` array (or fires never)
 * for `opacity: 0` absolute text on both Android and recent RN/Fabric
 * builds, which causes the toggle to silently disappear on real devices.
 * `onLayout` is reliable on both platforms because it's a layout-pass event,
 * not a text-render event.
 */
export const CollapsibleDescription = ({
  text,
  canCollapse = true,
  collapsedLines = DEFAULT_COLLAPSED_LINES,
  textClassName = "text-foreground leading-relaxed",
  noun = "description",
}: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [measurement, setMeasurement] = useState<
    "measuring" | "fits" | "overflows"
  >(canCollapse ? "measuring" : "fits");
  const clampedHeight = useRef<number | null>(null);
  const unclampedHeight = useRef<number | null>(null);

  // Reset measurement when the inputs that can change layout flip.
  useEffect(() => {
    clampedHeight.current = null;
    unclampedHeight.current = null;
    setMeasurement(canCollapse ? "measuring" : "fits");
    setExpanded(false);
  }, [canCollapse, text, collapsedLines]);

  const resolveIfReady = () => {
    const c = clampedHeight.current;
    const u = unclampedHeight.current;
    console.log("[CollapsibleDescription] resolveIfReady", {
      noun,
      clamped: c,
      unclamped: u,
      collapsedLines,
    });
    if (c == null || u == null) return;
    // Skip the mount-time "both heights are 0" race: RN can fire onLayout
    // once with zero before the real layout pass. Without this guard,
    // (0 > 0 + 1) === false sets measurement to "fits" prematurely and the
    // toggle never appears.
    if (c <= 0 || u <= 0) return;
    const next = u > c + 1 ? "overflows" : "fits";
    console.log("[CollapsibleDescription] resolved →", next, { c, u });
    // 1px slack — RN sometimes reports sub-pixel diffs even when content
    // fits within the clamp.
    setMeasurement(next);
  };

  console.log("[CollapsibleDescription] render", {
    noun,
    measurement,
    expanded,
    textLength: text?.length,
  });

  if (measurement === "fits") {
    return <AppText className={textClassName}>{text}</AppText>;
  }

  const toggle = () => setExpanded((v) => !v);

  return (
    <View>
      {measurement === "overflows" ? (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={expanded ? `Collapse ${noun}` : `Expand ${noun}`}
          className="active:opacity-70"
        >
          <AppText
            numberOfLines={expanded ? undefined : collapsedLines}
            className={textClassName}
          >
            {text}
          </AppText>
        </Pressable>
      ) : (
        // Measuring: render visible text fully so the parent View has a
        // proper width for the absolute twins to inherit. Once measurement
        // resolves to "overflows", the visible text re-renders clamped.
        <AppText className={textClassName}>{text}</AppText>
      )}

      {measurement === "measuring" && (
        // Twins are positioned offscreen (top: -9999) with the same
        // textClassName, so wrapping behavior matches the visible text.
        // Using `position: absolute` + `left/right: 0` stretches them to
        // the parent's measured width. Style is applied via `style` (not
        // className) to bypass any Uniwind class-stripping edge case.
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.measurementContainer}
        >
          <AppText
            numberOfLines={collapsedLines}
            className={textClassName}
            onLayout={(e) => {
              clampedHeight.current = e.nativeEvent.layout.height;
              resolveIfReady();
            }}
          >
            {text}
          </AppText>
          <AppText
            className={textClassName}
            onLayout={(e) => {
              unclampedHeight.current = e.nativeEvent.layout.height;
              resolveIfReady();
            }}
          >
            {text}
          </AppText>
        </View>
      )}

      {measurement === "overflows" && (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={expanded ? `Collapse ${noun}` : `Expand ${noun}`}
          hitSlop={6}
          className="mt-1 self-start active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-accent">
            {expanded ? "Show less" : "Show more"}
          </AppText>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  measurementContainer: {
    position: "absolute",
    // Off-screen positioning alone hides the twins — intentionally no
    // opacity: 0 here. Some Android/Fabric builds short-circuit layout for
    // fully-transparent subtrees, which would defeat the onLayout fix.
    top: -9999,
    left: 0,
    right: 0,
  },
});

export default CollapsibleDescription;
