import { View } from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import React, { useCallback, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useCourseDetails, useCourseStudents } from "../courses.hooks";
import { FlashList } from "@shopify/flash-list";
import Image from "@/components/Image";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import { LinearGradient } from "expo-linear-gradient";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { Skeleton, useThemeColor } from "heroui-native";

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

const CourseDetails = () => {
  const { classroomId, courseId } = useLocalSearchParams();
  const enrollmentId = (classroomId ?? courseId) as string;

  const {
    data: courseDetails,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useCourseDetails(enrollmentId);
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

  return (
    <FlashList
      className="w-full"
      refreshControl={
        <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View className="w-full max-w-3xl mx-auto">
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
      renderItem={({ item, index }) => (
        <View className="w-full max-w-3xl mx-auto">
          <StudentItem student={item as Student} index={index} />
        </View>
      )}
      ListEmptyComponent={
        <View className="w-full max-w-3xl mx-auto">
          {isLoadingStudents ? (
            <StudentListSkeleton />
          ) : isErrorStudents ? (
            <EmptyState
              icon="Warning"
              title="Failed to load students"
              description="Something went wrong while fetching the student list"
            />
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
    <View className="flex-row items-center mb-4 mx-1">
      <AppText weight="bold" className="text-lg">
        Enrolled Students
      </AppText>
      <View className="ml-auto bg-orange-100 dark:bg-orange-900 px-3 py-1.5 rounded-full">
        <AppText
          weight="semibold"
          className="text-[11px] text-orange-700 dark:text-orange-300"
        >
          {count}
        </AppText>
      </View>
    </View>
  );
};

const formatTime = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface InfoTileProps {
  icon: IconName;
  iconColor: string;
  iconBgClass: string;
  label: string;
  value: string;
}

const InfoTile = ({
  icon,
  iconColor,
  iconBgClass,
  label,
  value,
}: InfoTileProps) => (
  <View className="flex-1 bg-surface-secondary rounded-2xl p-4">
    <View
      className={`w-9 h-9 rounded-full items-center justify-center mb-3 ${iconBgClass}`}
    >
      <Icon name={icon} size={20} color={iconColor} />
    </View>
    <AppText className="text-[11px] text-muted uppercase tracking-wider mb-1">
      {label}
    </AppText>
    <AppText weight="semibold" className="text-sm">
      {value}
    </AppText>
  </View>
);

const CourseInfoCard = ({ courseDetails }: { courseDetails: any }) => {
  const accentColor = useThemeColor("accent");

  const instructorName = useMemo(() => {
    const first = courseDetails?.subjectId?.assignTeacherId?.firstName;
    const last = courseDetails?.subjectId?.assignTeacherId?.lastName;
    return [first, last].filter(Boolean).join(" ") || "Unassigned";
  }, [courseDetails]);

  const activeSchedules: Schedule[] = useMemo(() => {
    return (
      courseDetails?.schedules?.filter(
        (s: Schedule) => s.isActiveSemester === 1,
      ) || []
    );
  }, [courseDetails]);

  return (
    <View className="mb-6 mx-1 gap-3">
      <View className="flex-row gap-3">
        <InfoTile
          icon="UserCircleIcon"
          iconColor={accentColor}
          iconBgClass="bg-accent-soft"
          label="Instructor"
          value={instructorName}
        />
        <InfoTile
          icon="MapPinIcon"
          iconColor="#22c55e"
          iconBgClass="bg-green-100 dark:bg-green-900"
          label="Room"
          value={courseDetails?.subjectId?.roomNumber || "TBA"}
        />
      </View>

      {activeSchedules.length > 0 && (
        <View className="bg-surface-secondary rounded-2xl p-4">
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900 items-center justify-center mr-3">
              <Icon name="ClockIcon" size={20} color="#f97316" />
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
                        className="bg-orange-100 dark:bg-orange-900/50 px-2.5 py-1 rounded-lg"
                      >
                        <AppText
                          weight="semibold"
                          className="text-[11px] text-orange-700 dark:text-orange-300"
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
                    {formatTime(schedule.scheduleStartTime)} –{" "}
                    {formatTime(schedule.scheduleEndTime)}
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

const CourseDetailsHeader = ({ courseDetails }: { courseDetails: any }) => {
  const subjectType = courseDetails?.subjectId?.subjectType;

  return (
    <>
      <View className="relative mt-2.5">
        <AttachmentImage
          path={courseDetails?.subjectId?.subjectPhoto}
          fallback={
            <Image
              source={require("@/assets/placeholder/bg-placeholder.png")}
              className="rounded-2xl w-full aspect-video"
              contentFit="cover"
            />
          }
          className="rounded-2xl w-full aspect-video"
          contentFit="cover"
          cachePolicy="disk"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          className="absolute bottom-0 left-0 right-0 h-28 rounded-b-2xl"
        />
        {subjectType && (
          <View className="absolute top-3 right-3 bg-black/40 px-3 py-1.5 rounded-full">
            <AppText
              weight="semibold"
              className="text-[11px] text-white uppercase tracking-wider"
            >
              {subjectType}
            </AppText>
          </View>
        )}
      </View>

      <View className="mt-5 px-1 mb-5">
        <AppText weight="bold" className="text-2xl mb-1">
          {courseDetails?.subjectId?.subjectName}
        </AppText>
        <AppText className="text-base text-muted">
          {courseDetails?.subjectId?.subjectCode}
        </AppText>
      </View>
    </>
  );
};

const StudentItem = ({ student }: { student: Student; index: number }) => {
  return (
    <View className="flex-row items-center bg-surface rounded-xl p-3 mb-2 border border-border mx-1">
      <View className="relative">
        <AttachmentImage
          path={student?.studentPhoto}
          fallback={
            <Image
              source={require("@/assets/placeholder/avatar-placeholder.png")}
              className="w-12 h-12 rounded-full"
              contentFit="cover"
            />
          }
          className="w-12 h-12 rounded-full"
          contentFit="cover"
          cachePolicy="disk"
        />
      </View>
      <View className="flex-1 ml-3">
        <AppText weight="semibold" className="text-base">
          {student.name}
        </AppText>
      </View>
    </View>
  );
};

const StudentListSkeleton = () => {
  return (
    <View className="gap-2 mx-1">
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
};

const CourseDetailsSkeleton = () => {
  return (
    <View className="w-full max-w-3xl mx-auto p-2.5">
      <Skeleton className="rounded-2xl w-full aspect-video mt-2.5" />
      <View className="mt-5 px-1 gap-1.5 mb-5">
        <Skeleton className="h-7 w-3/4 rounded" />
        <Skeleton className="h-5 w-1/3 rounded" />
      </View>

      <View className="flex-row gap-3 mx-1 mb-3">
        <View className="flex-1 bg-surface-secondary rounded-2xl p-4 gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <View className="gap-1.5">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </View>
        </View>
        <View className="flex-1 bg-surface-secondary rounded-2xl p-4 gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <View className="gap-1.5">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </View>
        </View>
      </View>

      <View className="bg-surface-secondary rounded-2xl p-4 mx-1 mb-6 gap-3">
        <View className="flex-row items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <Skeleton className="h-4 w-28 rounded" />
        </View>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </View>

      <View className="gap-2 mx-1">
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
    </View>
  );
};

export default CourseDetails;
