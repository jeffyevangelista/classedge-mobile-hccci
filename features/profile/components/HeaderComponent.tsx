import { View } from "react-native";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { Avatar, Skeleton } from "heroui-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { ErrorComponent } from "@/components/ErrorComponent";
import { getApiErrorMessage } from "@/lib/api-error";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { toTitleCase } from "@/utils/toTitleCase";

const HeaderComponent = () => {
  const { data, isLoading, error } = useUserDetails();

  if (isLoading) return <ProfileHeaderSkeleton />;
  if (error) return <ErrorComponent message={getApiErrorMessage(error)} />;

  const userDetails = data?.[0];
  const fullName = userDetails
    ? toTitleCase(`${userDetails.firstName} ${userDetails.lastName}`)
    : "User";

  return (
    <View className="items-center">
      <View className="p-1 border-2 border-accent rounded-full">
        <Avatar className="w-28 h-28" alt={fullName}>
          <AttachmentAvatarImage path={userDetails?.studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>
      </View>

      <View className="items-center mt-6">
        <AppText weight="bold" className="text-2xl">
          {fullName}
        </AppText>
        <AppText className="text-sm text-muted">
          {userDetails?.userId?.email}
        </AppText>
        <AppText weight="semibold" className="text-xs">
          {userDetails?.idNumber}
        </AppText>
      </View>
    </View>
  );
};

const ProfileHeaderSkeleton = () => {
  return (
    <View className="items-center">
      <View className="p-1 border-2 border-border rounded-full">
        <Skeleton className="w-28 h-28 rounded-full" />
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
