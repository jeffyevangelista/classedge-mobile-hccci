import {
  View,
  Pressable,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useMemo } from "react";
import { BottomSheet } from "heroui-native";
import { Icon } from "@/components/Icon";
import {
  InfoIcon,
  UserCircleIcon,
  MapPinIcon,
  UsersIcon,
} from "phosphor-react-native";
import { useLocalSearchParams } from "expo-router";
import { useCourseDetails, useCourseStudents } from "../courses.hooks";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { env } from "@/utils/env";
import { LinearGradient } from "expo-linear-gradient";
import { FlashList } from "@shopify/flash-list";

const BOTTOM_SHEET_MAX_WIDTH = 768;

interface CourseDetailsHeaderProps {
  courseDetails: any;
}

const CourseDetailsHeader = ({ courseDetails }: CourseDetailsHeaderProps) => {
  return (
    <>
      <View className="relative">
        <Image
          source={
            courseDetails?.subjectId.subjectPhoto
              ? {
                  uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${courseDetails?.subjectId.subjectPhoto}`,
                }
              : require("@/assets/placeholder/bg-placeholder.png")
          }
          className="rounded-3xl w-full aspect-video"
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

const CourseInfoCard = ({ courseDetails }: CourseDetailsHeaderProps) => {
  return (
    <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6 mx-1">
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 items-center justify-center mr-3">
          <Icon as={UserCircleIcon} size={24} color="#3b82f6" />
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
          <Icon as={MapPinIcon} size={24} color="#22c55e" />
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

interface StudentItemProps {
  student: any;
  index: number;
}

const StudentItem = ({ student, index }: StudentItemProps) => {
  return (
    <View className="flex-row items-center bg-white dark:bg-gray-800 rounded-xl p-3 mb-2 border border-gray-100 dark:border-gray-700 mx-1">
      <View className="relative">
        {student.studentPhoto ? (
          <Image
            source={{
              uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${student.studentPhoto}`,
            }}
            className="w-12 h-12 rounded-full"
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center">
            <Icon as={UserCircleIcon} size={32} color="#9ca3af" />
          </View>
        )}
        <View className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full w-5 h-5 items-center justify-center">
          <AppText className="text-white text-xs font-bold">
            {index + 1}
          </AppText>
        </View>
      </View>
      <View className="flex-1 ml-3">
        <AppText className="text-base font-semibold">
          {student.firstName} {student.lastName}
        </AppText>
        <AppText className="text-sm text-gray-500">
          Year {student.gradeYearLevel || "N/A"}
        </AppText>
      </View>
    </View>
  );
};

interface StudentListHeaderProps {
  count: number;
}

const StudentListHeader = ({ count }: StudentListHeaderProps) => {
  return (
    <View className="flex-row items-center mb-4 mx-1">
      <View className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 items-center justify-center mr-3">
        <Icon as={UsersIcon} size={24} color="#f97316" />
      </View>
      <AppText className="text-xl font-bold">Enrolled Students</AppText>
      <View className="ml-auto bg-orange-100 dark:bg-orange-900 px-3 py-1 rounded-full">
        <AppText className="text-sm font-semibold text-orange-600 dark:text-orange-400">
          {count}
        </AppText>
      </View>
    </View>
  );
};

const CourseDetailsSheet = () => {
  const { courseId } = useLocalSearchParams();

  const { data: courseDetails, isLoading: isLoadingDetails } = useCourseDetails(
    courseId as string,
  );
  const { data: students, isLoading: isLoadingStudents } = useCourseStudents(
    courseDetails?.subjectId?.id,
  );
  const { width: screenWidth } = useWindowDimensions();

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 0,
      minHeight: 400,
    }),
    [screenWidth],
  );

  return (
    <BottomSheet>
      <BottomSheet.Trigger asChild>
        <Pressable className="w-9 h-9 rounded-full flex justify-center items-center">
          <Icon
            as={InfoIcon}
            style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
          />
        </Pressable>
      </BottomSheet.Trigger>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["85%", "95%"]} style={contentStyle}>
          {isLoadingDetails ? (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <FlashList
              data={students || []}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <>
                  <CourseDetailsHeader courseDetails={courseDetails} />
                  <CourseInfoCard courseDetails={courseDetails} />
                  {students && students.length > 0 && (
                    <StudentListHeader count={students.length} />
                  )}
                </>
              }
              renderItem={({ item, index }) => (
                <StudentItem student={item} index={index} />
              )}
              ListEmptyComponent={
                isLoadingStudents ? (
                  <View className="py-8 items-center">
                    <ActivityIndicator />
                  </View>
                ) : (
                  <View className="py-8 items-center mx-1">
                    <Icon as={UsersIcon} size={48} color="#d1d5db" />
                    <AppText className="text-gray-400 mt-2">
                      No students enrolled yet
                    </AppText>
                  </View>
                )
              }
              contentContainerStyle={{ paddingBottom: 24 }}
              keyExtractor={(item) => item.studentId.toString()}
            />
          )}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

export default CourseDetailsSheet;
