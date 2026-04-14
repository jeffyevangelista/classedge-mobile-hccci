import { View } from "react-native";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { Avatar, Skeleton } from "heroui-native";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { env } from "@/utils/env";

const HeaderComponent = () => {
  const { data, isLoading, isError, error } = useUserDetails();

  if (isLoading) return <ProfileHeaderSkeleton />;
  if (isError) return <ErrorComponent message={error.message} />;

  const userDetails = data?.[0];

  return (
    <View className="items-center">
      <View className="p-1 border-3 border-blue-500 rounded-full">
        <Avatar
          className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40"
          alt={
            userDetails
              ? `${userDetails.firstName} ${userDetails.lastName}`
              : "User"
          }
        >
          <Avatar.Image
            source={
              userDetails?.studentPhoto
                ? {
                    uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${userDetails.studentPhoto}`,
                  }
                : require("@/assets/placeholder/avatar-placeholder.png")
            }
          />
          <Avatar.Fallback>
            {userDetails?.firstName?.[0] ?? ""}
            {userDetails?.lastName?.[0] ?? ""}
          </Avatar.Fallback>
        </Avatar>
      </View>

      <View className="items-center mt-6">
        <AppText
          weight="bold"
          className="text-2xl sm:text-3xl text-slate-900 dark:text-slate-100"
        >
          {userDetails?.firstName} {userDetails?.lastName}
        </AppText>
        <AppText className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
          {userDetails?.userId?.email}
        </AppText>
        <AppText weight="semibold" className="text-xs sm:text-sm">
          {userDetails?.idNumber}
        </AppText>
      </View>
    </View>
  );
};

const ProfileHeaderSkeleton = () => {
  return (
    <View className="items-center">
      <View className="p-1 border-3 border-gray-200 dark:border-gray-700 rounded-full">
        <Skeleton className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full" />
      </View>
      <View className="items-center mt-6 gap-2">
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </View>
    </View>
  );
};

export default HeaderComponent;
