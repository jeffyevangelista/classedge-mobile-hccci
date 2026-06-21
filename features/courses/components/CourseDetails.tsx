import { Pressable, View } from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import React, { useCallback, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import useStore from "@/lib/store";
import {
  useCourseDetails,
  useCourseStudents,
  useTeacherCourseDetails,
} from "../courses.hooks";
import { ScreenList } from "@/components/ScreenList";
import Image from "@/components/Image";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon, type IconName } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { Skeleton, useThemeColor } from "heroui-native";
import { formatTime } from "@/features/calendar/components/date-formatter";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

type Schedule = {
  id: number;
  daysOfWeek: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  isActiveSemester: number;
};

type Student = {
  name: string;
  studentPhoto?: string | null;
};

type CourseDetailsData = {
  schedules?: Schedule[] | null;
  subjectId?: {
    id?: number;
    subjectName?: string | null;
    subjectCode?: string | null;
    subjectPhoto?: string | null;
    subjectType?: string | null;
    roomNumber?: string | null;
    assignTeacherId?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

const CourseDetails = () => {
  const { classroomId, courseId } = useLocalSearchParams();
  const idFromUrl = (classroomId ?? courseId) as string;
  const role = useStore((s) => s.authUser?.role);
  const isTeacher = role === "Teacher";

  // For teachers the URL id is a subject id (TeachingCourseList links
  // directly to /classroom/<subject.id>); for students it's an enrollment
  // id. Both hooks return the same `{ subjectId, schedules }` shape.
  const studentResult = useCourseDetails(isTeacher ? "" : idFromUrl);
  const teacherResult = useTeacherCourseDetails(isTeacher ? idFromUrl : "");
  const {
    data: courseDetails,
    isLoading: isLoadingDetails,
    isError: isErrorDetails,
    error: detailsError,
    refetch: refetchDetails,
  } = isTeacher ? teacherResult : studentResult;
  const {
    data: students,
    isLoading: isLoadingStudents,
    isError: isErrorStudents,
    refetch: refetchStudents,
  } = useCourseStudents(courseDetails?.subjectId?.id);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDetails(), refetchStudents()]);
    setRefreshing(false);
  }, [refetchDetails, refetchStudents]);

  if (isLoadingDetails) return <CourseDetailsSkeleton />;
  if (isErrorDetails)
    return (
      <ErrorComponent
        message={getApiErrorMessage(detailsError)}
        onRetry={() => refetchDetails()}
      />
    );

  return (
    <ScreenList
      className="w-full"
      style={{ marginBottom: 0 }}
      refreshControl={
        <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View className="w-full max-w-3xl mx-auto px-2.5">
          <CourseDetailsHeader courseDetails={courseDetails} />
          <CourseInfoCard courseDetails={courseDetails} />
          {!isLoadingStudents &&
            !isErrorStudents &&
            students &&
            students.length > 0 && (
              <StudentListHeader count={students.length} />
            )}
        </View>
      }
      data={isLoadingStudents || isErrorStudents ? [] : students || []}
      ItemSeparatorComponent={() => (
        <View className="w-full max-w-3xl mx-auto px-2.5">
          <View className="h-px bg-border ml-[52px]" />
        </View>
      )}
      renderItem={({ item }) => (
        <View className="w-full max-w-3xl mx-auto px-2.5">
          <StudentItem student={item as Student} />
        </View>
      )}
      ListEmptyComponent={
        <View className="w-full max-w-3xl mx-auto px-2.5">
          {isLoadingStudents ? (
            <StudentListSkeleton />
          ) : isErrorStudents ? (
            <View className="items-center">
              <EmptyState
                icon="Warning"
                title="Failed to load students"
                description="Something went wrong while fetching the student list"
              />
              <Pressable
                onPress={() => refetchStudents()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading students"
                className="mt-2 px-4 py-2 rounded-full bg-accent-soft active:opacity-70"
              >
                <AppText weight="semibold" className="text-sm text-accent">
                  Try again
                </AppText>
              </Pressable>
            </View>
          ) : (
            <EmptyState
              icon="UsersIcon"
              title="No students enrolled"
              description="No students are enrolled in this course yet"
            />
          )}
        </View>
      }
    />
  );
};

const StudentListHeader = ({ count }: { count: number }) => {
  return (
    <View className="px-3 mb-2">
      <AppText
        weight="semibold"
        className="text-xs uppercase tracking-wider text-muted"
      >
        Enrolled Students · {count}
      </AppText>
    </View>
  );
};

const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const safeFormatTime = (time?: string | null) => {
  if (!time) return "";
  return formatTime(time.slice(0, 8));
};

interface InfoRowProps {
  icon: IconName;
  iconColor: string;
  iconBgClass: string;
  label: string;
  value: string;
}

const InfoRow = ({
  icon,
  iconColor,
  iconBgClass,
  label,
  value,
}: InfoRowProps) => (
  <View className="flex-row items-center gap-3 py-3">
    <View
      className={`w-8 h-8 rounded-full items-center justify-center ${iconBgClass}`}
    >
      <Icon name={icon} size={16} color={iconColor} />
    </View>
    <View className="flex-1">
      <AppText weight="semibold" className="text-sm" numberOfLines={1}>
        {value}
      </AppText>
      <AppText className="text-[11px] text-muted">{label}</AppText>
    </View>
  </View>
);

const CourseInfoCard = ({
  courseDetails,
}: {
  courseDetails: CourseDetailsData | null | undefined;
}) => {
  const accentColor = useThemeColor("accent");

  const instructorName = useMemo(() => {
    const first = courseDetails?.subjectId?.assignTeacherId?.firstName;
    const last = courseDetails?.subjectId?.assignTeacherId?.lastName;
    return toTitleCase([first, last].filter(Boolean).join(" ")) || "Unassigned";
  }, [courseDetails]);

  const activeSchedules: Schedule[] = useMemo(() => {
    return (
      courseDetails?.schedules?.filter(
        (s: Schedule) => s.isActiveSemester === 1,
      ) || []
    );
  }, [courseDetails]);

  return (
    <View className="mb-6 gap-3">
      <View className="bg-surface-secondary rounded-2xl px-4">
        <InfoRow
          icon="UserCircleIcon"
          iconColor={accentColor}
          iconBgClass="bg-accent-soft"
          label="Instructor"
          value={instructorName}
        />
        <View className="h-px bg-border" />
        <InfoRow
          icon="MapPinIcon"
          iconColor={accentColor}
          iconBgClass="bg-accent-soft"
          label="Room"
          value={courseDetails?.subjectId?.roomNumber || "TBA"}
        />
      </View>

      {activeSchedules.length > 0 && (
        <View className="bg-surface-secondary rounded-2xl p-4">
          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 rounded-full bg-accent-soft items-center justify-center mr-3">
              <Icon name="ClockIcon" size={16} color={accentColor} />
            </View>
            <AppText weight="semibold" className="text-sm">
              Class Schedule
            </AppText>
          </View>

          <View className="gap-2.5">
            {activeSchedules.map((schedule) => {
              const days = schedule.daysOfWeek
                .split(",")
                .map((d: string) => d.trim())
                .sort(
                  (a: string, b: string) =>
                    DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
                );

              return (
                <View
                  key={schedule.id}
                  className="flex-row items-center justify-between bg-surface rounded-xl px-3.5 py-3"
                >
                  <View className="flex-row items-center gap-1.5 flex-1 flex-wrap">
                    {days.map((day: string) => (
                      <View
                        key={day}
                        className="bg-accent-soft px-2.5 py-1 rounded-lg"
                      >
                        <AppText
                          weight="semibold"
                          className="text-[11px] text-accent"
                        >
                          {day}
                        </AppText>
                      </View>
                    ))}
                  </View>
                  <AppText
                    weight="semibold"
                    className="text-xs text-muted ml-2"
                  >
                    {safeFormatTime(schedule.scheduleStartTime)} –{" "}
                    {safeFormatTime(schedule.scheduleEndTime)}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const CourseDetailsHeader = ({
  courseDetails,
}: {
  courseDetails: CourseDetailsData | null | undefined;
}) => {
  const subjectType = courseDetails?.subjectId?.subjectType;
  const subjectName = courseDetails?.subjectId?.subjectName;
  const subjectCode = courseDetails?.subjectId?.subjectCode;
  const showCode = !!subjectCode && subjectCode !== subjectName;

  return (
    <View className="mt-2.5 mb-5">
      <View className="rounded-2xl overflow-hidden bg-surface-secondary aspect-video">
        <AttachmentImage
          path={courseDetails?.subjectId?.subjectPhoto}
          fallback={
            <Image
              source={require("@/assets/placeholder/bg-placeholder.png")}
              className="w-full h-full"
              contentFit="cover"
            />
          }
          className="w-full h-full"
          contentFit="cover"
          cachePolicy="disk"
        />
      </View>

      <View className="mt-4">
        <AppText weight="bold" className="text-2xl" numberOfLines={2}>
          {subjectName}
        </AppText>
        {(subjectType || showCode) && (
          <View className="flex-row items-center gap-2 mt-1.5">
            {subjectType && (
              <View className="bg-accent-soft px-2.5 py-1 rounded-full">
                <AppText
                  weight="semibold"
                  className="text-[11px] text-accent uppercase tracking-wider"
                >
                  {subjectType}
                </AppText>
              </View>
            )}
            {showCode && (
              <AppText className="text-sm text-muted">{subjectCode}</AppText>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const StudentItem = ({ student }: { student: Student }) => {
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <AttachmentImage
        path={student?.studentPhoto}
        fallback={
          <Image
            source={require("@/assets/placeholder/avatar-placeholder.png")}
            className="w-10 h-10 rounded-full"
            contentFit="cover"
          />
        }
        className="w-10 h-10 rounded-full"
        contentFit="cover"
        cachePolicy="disk"
      />
      <AppText weight="semibold" className="text-sm flex-1" numberOfLines={1}>
        {toTitleCase(student.name)}
      </AppText>
    </View>
  );
};

const CourseDetailsHeaderSkeleton = () => (
  <View className="mt-2.5 mb-5">
    <Skeleton className="rounded-2xl w-full aspect-video" />
    <View className="mt-4 gap-2">
      <Skeleton className="h-7 w-3/4 rounded" />
      <View className="flex-row items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-4 w-20 rounded" />
      </View>
    </View>
  </View>
);

const InfoRowSkeleton = () => (
  <View className="flex-row items-center gap-3 py-3">
    <Skeleton className="w-8 h-8 rounded-full" />
    <View className="flex-1 gap-1.5">
      <Skeleton className="h-4 w-32 rounded" />
      <Skeleton className="h-3 w-16 rounded" />
    </View>
  </View>
);

const InfoTilesSkeleton = () => (
  <View className="bg-surface-secondary rounded-2xl px-4 mb-3">
    <InfoRowSkeleton />
    <View className="h-px bg-border" />
    <InfoRowSkeleton />
  </View>
);

const ScheduleSkeleton = () => (
  <View className="bg-surface-secondary rounded-2xl p-4 mb-6 gap-3">
    <View className="flex-row items-center gap-3">
      <Skeleton className="w-9 h-9 rounded-full" />
      <Skeleton className="h-4 w-28 rounded" />
    </View>
    <Skeleton className="h-12 w-full rounded-xl" />
    <Skeleton className="h-12 w-full rounded-xl" />
  </View>
);

const StudentListSkeleton = () => (
  <View className="gap-2">
    <Skeleton className="h-5 w-40 rounded mb-2" />
    {Array(3)
      .fill(0)
      .map((_, index) => (
        <View
          key={index}
          className="flex-row items-center rounded-xl p-3 mb-2 gap-3"
        >
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-4 w-32 rounded" />
        </View>
      ))}
  </View>
);

const CourseDetailsSkeleton = () => (
  <View className="w-full max-w-3xl mx-auto p-2.5">
    <CourseDetailsHeaderSkeleton />
    <InfoTilesSkeleton />
    <ScheduleSkeleton />
    <StudentListSkeleton />
  </View>
);

export default CourseDetails;
