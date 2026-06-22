import { useRouter } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import Fallback from "@/components/Fallback";
import { Icon } from "@/components/Icon";
import { useAssessmentMaterials } from "@/features/assessment/assessment.hooks";

interface Props {
  activityId: string | undefined;
  /**
   * Suppress the "MATERIALS" section label (and its "N total" counter).
   * Use when rendered inside a tab named "Materials" — the tab is the
   * label, so the inner header would just duplicate it.
   */
  hideHeader?: boolean;
}

// Show this many materials by default. Teachers can attach an unbounded
// number, so we cap the visible list to keep the Results section reachable
// without excessive scrolling.
const DEFAULT_VISIBLE = 3;

export const AssessmentMaterials = ({
  activityId,
  hideHeader = false,
}: Props) => {
  const router = useRouter();
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");
  const { data, isLoading } = useAssessmentMaterials(activityId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <View>
        {hideHeader ? null : (
          <AppText
            weight="semibold"
            className="text-xs uppercase tracking-wider text-muted mb-2"
          >
            Materials
          </AppText>
        )}
        <View className="gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </View>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View>
        {hideHeader ? null : (
          <AppText
            weight="semibold"
            className="text-xs uppercase tracking-wider text-muted mb-2"
          >
            Materials
          </AppText>
        )}
        <Fallback
          variant="empty"
          density="inline"
          icon="BookOpenIcon"
          title="No materials"
          description="There are no materials linked to this assessment."
        />
      </View>
    );
  }

  const total = data.length;
  const canCollapse = total > DEFAULT_VISIBLE;
  const visible =
    expanded || !canCollapse ? data : data.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = total - DEFAULT_VISIBLE;

  return (
    <View>
      {hideHeader ? null : (
        <View className="flex-row items-center justify-between mb-2">
          <AppText
            weight="semibold"
            className="text-xs uppercase tracking-wider text-muted"
          >
            Materials
          </AppText>
          {canCollapse ? (
            <AppText className="text-xs text-muted">{total} total</AppText>
          ) : null}
        </View>
      )}

      <View className="gap-2">
        {visible.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => router.push(`/material/${m.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open lesson ${m.fileName}`}
            android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
            className="rounded-2xl overflow-hidden active:opacity-80"
          >
            <View className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3">
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-accent-soft">
                <Icon name="BookOpenIcon" size={18} color={accentColor} />
              </View>
              <View className="flex-1 min-w-0">
                <AppText
                  weight="semibold"
                  className="text-[15px] text-foreground"
                  numberOfLines={1}
                >
                  {m.fileName}
                </AppText>
                {m.description ? (
                  <AppText
                    className="text-xs text-muted mt-0.5"
                    numberOfLines={1}
                  >
                    {m.description}
                  </AppText>
                ) : null}
              </View>
              <Icon name="CaretRightIcon" size={16} color={mutedColor} />
            </View>
          </Pressable>
        ))}
      </View>

      {canCollapse ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Show fewer materials" : `Show all ${total} materials`
          }
          hitSlop={6}
          className="mt-2 self-start active:opacity-70"
        >
          <View className="flex-row items-center gap-1">
            <AppText weight="semibold" className="text-sm text-accent">
              {expanded ? "Show less" : `Show all ${total} (+${hiddenCount})`}
            </AppText>
            <Icon
              name={expanded ? "CaretUpIcon" : "CaretDownIcon"}
              size={14}
              color={accentColor}
            />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
};
