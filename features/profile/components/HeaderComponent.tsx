import { Pressable, StyleSheet, View } from "react-native";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { Avatar, Skeleton } from "heroui-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { Icon } from "@/components/Icon";
import { getApiErrorMessage } from "@/lib/api-error";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { toTitleCase } from "@/utils/toTitleCase";
import Image from "@/components/Image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import useStore from "@/lib/store";

const HeaderComponent = () => {
  const { data, isLoading, error } = useUserDetails();
  const role = useStore((s) => s.authUser?.role);

  if (isLoading) return <ProfileHeaderSkeleton />;
  if (error) return <ProfileHeaderError message={getApiErrorMessage(error)} />;

  const userDetails = data?.[0];
  const fullName = userDetails
    ? toTitleCase(`${userDetails.firstName} ${userDetails.lastName}`)
    : "User";

  return (
    <View className="w-full items-center">
      <View className="h-[180px] rounded-xl w-full overflow-hidden">
        <Image
          source={require("@/assets/bldg.jpg")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {/* Vertical scrim: photo stays vibrant at the top, contrast lands
            where the avatar overlaps the bottom edge. */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Avatar overlaps the bottom of the cover by half its height */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Profile Information"
        onPress={() => router.push("/(main)/profile/profile-info")}
        className="-mt-14 p-1.5 bg-background rounded-full active:opacity-80"
      >
        <Avatar className="w-28 h-28" alt={fullName}>
          <AttachmentAvatarImage path={userDetails?.studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>
      </Pressable>

      <View className="items-center mt-4 px-2.5">
        <AppText weight="bold" className="text-2xl">
          {fullName}
        </AppText>
        {role ? (
          <View className="mt-1 px-2.5 py-0.5 rounded-full bg-accent-soft">
            <AppText weight="semibold" className="text-[11px] text-accent">
              {role}
            </AppText>
          </View>
        ) : null}
        <AppText className="text-sm text-muted mt-1" numberOfLines={1}>
          {userDetails?.userId?.email}
        </AppText>
        {userDetails?.idNumber ? (
          <AppText weight="semibold" className="text-xs text-muted mt-0.5">
            ID · {userDetails.idNumber}
          </AppText>
        ) : null}
      </View>
    </View>
  );
};

const ProfileHeaderError = ({ message }: { message: string }) => (
  <View className="w-full items-center gap-2 p-4 rounded-xl bg-danger-soft border border-danger/30">
    <Icon name="WarningIcon" size={24} className="text-danger" />
    <AppText weight="semibold" className="text-sm text-danger">
      Couldn't load your profile
    </AppText>
    <AppText className="text-xs text-danger/80 text-center">{message}</AppText>
  </View>
);

const ProfileHeaderSkeleton = () => {
  return (
    <View className="w-full items-center">
      <Skeleton className="h-[180px] w-full rounded-xl" />
      <View className="-mt-14 p-1.5 bg-background rounded-full">
        <Skeleton className="w-28 h-28 rounded-full" />
      </View>
      <View className="items-center mt-4 gap-2 px-2.5">
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </View>
    </View>
  );
};

export default HeaderComponent;
