import { AppState, View } from "react-native";
import { Link } from "expo-router";
import { Avatar, Skeleton } from "heroui-native";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { useEffect, useState } from "react";
import { getGreeting } from "@/utils/getGreeting";
import SyncCenter from "@/features/sync/components/SyncCenter";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api-error";

const TabsHeader = () => {
  const { data, isLoading, error, refresh } = useUserDetails();
  const [greeting, setGreeting] = useState(getGreeting());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setGreeting(getGreeting());
      }
    });

    return () => subscription.remove();
  }, []);

  if (isLoading) return <TabsHeaderSkeleton />;
  if (error) return <ErrorComponent message={getApiErrorMessage(error)} />;

  const userDetails = data?.[0];

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-surface px-5 pb-3 flex flex-row justify-between items-center border-b border-border"
    >
      <Link href="/(main)/profile">
        <View className="flex flex-row items-center gap-3">
          <Avatar size="sm" alt="user-profile">
            <AttachmentAvatarImage path={userDetails?.studentPhoto} />
            <Avatar.Fallback>
              {userDetails?.firstName?.[0] ?? ""}
              {userDetails?.lastName?.[0] ?? ""}
            </Avatar.Fallback>
          </Avatar>
          <View>
            <AppText className="text-xs text-muted">
              {greeting}
            </AppText>
            <AppText
              weight="semibold"
              className="text-2xl leading-tight text-foreground"
            >
              {userDetails?.firstName
                ? userDetails.firstName.split(" ")[0]
                : ""}
            </AppText>
          </View>
        </View>
      </Link>
      <SyncCenter />
    </View>
  );
};

const TabsHeaderSkeleton = () => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-surface px-5 pb-3 flex flex-row justify-between items-center border-b border-border"
    >
      <View className="flex flex-row items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <View className="gap-1.5">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-6 w-28 rounded" />
        </View>
      </View>
      <Skeleton className="w-8 h-8 rounded-full" />
    </View>
  );
};

export default TabsHeader;
