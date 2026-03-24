import { View, Text, RefreshControl } from "react-native";
import React, { useCallback, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useCourseDetails, useCourseStudents } from "../courses.hooks";
import { FlashList } from "@shopify/flash-list";
import Image from "@/components/Image";
import { LinearGradient } from "expo-linear-gradient";
import { AppText } from "@/components/AppText";
import { env } from "@/utils/env";
import { Icon } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "heroui-native";

const CourseDetails = () => {
  const { courseId } = useLocalSearchParams();

  const {
    data: courseDetails,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useCourseDetails(courseId as string);
  const {
    data: students,
    isLoading: isLoadingStudents,
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
      className="w-full max-w-3xl mx-auto "
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <>
          <CourseDetailsHeader courseDetails={courseDetails} />
          <CourseInfoCard courseDetails={courseDetails} />
          {students && students.length > 0 && (
            <StudentListHeader count={students.length} />
          )}
        </>
      }
      data={students || []}
      renderItem={({ item, index }) => (
        <StudentItem student={item} index={index} />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="UsersIcon"
          title="No students enrolled"
          description="No students are enrolled in this course yet"
        />
      }
    />
  );
};

const StudentListHeader = ({ count }: { count: number }) => {
  return (
    <View className="flex-row items-center mb-4 mx-1">
      <AppText className="text-xl font-bold">Enrolled Students</AppText>
      <View className="ml-auto bg-orange-100 dark:bg-orange-900 px-3 py-1 rounded-full"></View>
    </View>
  );
};

const CourseInfoCard = ({ courseDetails }: { courseDetails: any }) => {
  return (
    <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6 mx-1">
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 items-center justify-center mr-3">
          <Icon name="UserCircleIcon" size={24} color="#3b82f6" />
        </View>
        <View className="flex-1">
          <AppText className="text-xs text-gray-500 mb-1">Instructor</AppText>
          <AppText className="text-base font-semibold">
            {courseDetails?.subjectId.assignTeacherId.firstName}{" "}
            {courseDetails?.subjectId.assignTeacherId.lastName}
          </AppText>
        </View>
      </View>

      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 items-center justify-center mr-3">
          <Icon name="MapPinIcon" size={24} color="#22c55e" />
        </View>
        <View className="flex-1">
          <AppText className="text-xs text-gray-500 mb-1">Room</AppText>
          <AppText className="text-base font-semibold">
            {courseDetails?.subjectId.roomNumber || "TBA"}
          </AppText>
        </View>
      </View>
    </View>
  );
};

const CourseDetailsHeader = ({ courseDetails }: { courseDetails: any }) => {
  return (
    <>
      <View className="relative mt-2.5">
        <Image
          source={
            courseDetails?.subjectId.subjectPhoto
              ? {
                  uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${courseDetails?.subjectId.subjectPhoto}`,
                }
              : require("@/assets/placeholder/bg-placeholder.png")
          }
          className="rounded-xl w-full aspect-video"
          contentFit="cover"
          cachePolicy="disk"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          className="absolute bottom-0 left-0 right-0 h-24 rounded-b-3xl"
        />
      </View>

      <View className="mt-6 px-1">
        <AppText className="text-3xl font-bold mb-2">
          {courseDetails?.subjectId.subjectName}
        </AppText>
        <AppText className="text-lg text-gray-500 mb-6">
          {courseDetails?.subjectId.subjectCode}
        </AppText>
      </View>
    </>
  );
};

const StudentItem = ({ student, index }: { student: any; index: number }) => {
  return (
    <View className="flex-row items-center bg-white dark:bg-gray-800 rounded-xl p-3 mb-2 border border-gray-100 dark:border-gray-700 mx-1">
      <View className="relative">
        <Image
          source={
            student?.studentPhoto
              ? {
                  uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${student.studentPhoto}`,
                }
              : require("@/assets/placeholder/avatar-placeholder.png")
          }
          className="w-12 h-12 rounded-full"
          contentFit="cover"
          cachePolicy="disk"
        />
      </View>
      <View className="flex-1 ml-3">
        <AppText className="text-base font-semibold">
          {student.firstName} {student.lastName}
        </AppText>
      </View>
    </View>
  );
};

const CourseDetailsSkeleton = () => {
  return (
    <View className="w-full max-w-3xl mx-auto p-2.5">
      <Skeleton className="rounded-xl w-full aspect-video mt-2.5" />
      <View className="mt-6 px-1 gap-2">
        <Skeleton className="h-8 w-3/4 rounded" />
        <Skeleton className="h-5 w-1/3 rounded mb-6" />
      </View>
      <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6 mx-1 gap-3">
        <View className="flex-row items-center">
          <Skeleton className="w-10 h-10 rounded-full mr-3" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
          </View>
        </View>
        <View className="flex-row items-center">
          <Skeleton className="w-10 h-10 rounded-full mr-3" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </View>
        </View>
      </View>
      <View className="gap-2 mx-1">
        <Skeleton className="h-5 w-40 rounded mb-2" />
        {Array(4)
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
