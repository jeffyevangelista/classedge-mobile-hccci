import { formatDate } from "@/utils/formatDate";
import { Assessment } from "../oversight.type";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";

// All coursework rows render with a single pencil icon, mirroring the
// CourseTimeline assessment convention. Only the meta label differs
// by activity type so a teacher still sees Quiz / Exam / etc. in the
// row text — `Assignment` is dropped as a label because it's the
// catch-all default; saying "Assignment" on every plain row is noise.
const ACTIVITY_LABELS: Record<string, string> = {
  Exam: "Exam",
  SpecialActivity: "Special Activity",
  Quiz: "Quiz",
  Participation: "Participation",
};

const labelForActivityType = (activityType: string): string | null =>
  ACTIVITY_LABELS[activityType] ?? null;

const CourseworkItem = ({
  activityName,
  activityTypeName,
  endTime,
  classroomMode,
  attempts,
  id,
}: Assessment) => {
  const label = labelForActivityType(activityTypeName);
  const formattedDate = endTime ? formatDate(endTime, true) : null;

  const isClassroomActivity = !!classroomMode;
  const hasSubmission = (attempts?.length ?? 0) > 0;

  return (
    <Link href={`/activity/${id}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          label ? `Open ${label}: ${activityName}` : `Open ${activityName}`
        }
        android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
        className="w-full max-w-3xl mx-auto mb-1 px-2.5 active:opacity-80"
      >
        <View className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3">
          <View className="w-10 h-10 rounded-full items-center justify-center bg-accent-soft">
            <Icon name="PencilLineIcon" size={18} className="text-accent" />
          </View>
          <View className="flex-1 min-w-0">
            <AppText
              weight="semibold"
              className="text-[15px] text-foreground"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {activityName}
            </AppText>
            <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
              <AppText className="text-[11px] text-muted" numberOfLines={1}>
                {label ? `${label} · ` : ""}
                {formattedDate ? `Due ${formattedDate}` : ""}
              </AppText>
              {isClassroomActivity ? (
                <View className="px-2 py-0.5 rounded-full bg-accent-soft">
                  <AppText
                    weight="semibold"
                    className="text-[10px] text-accent"
                  >
                    In class
                  </AppText>
                </View>
              ) : hasSubmission ? (
                <View className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                  <AppText
                    weight="semibold"
                    className="text-[10px]"
                    style={{ color: "#10b981" }}
                  >
                    Submitted
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
};

export default CourseworkItem;
