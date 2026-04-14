import { AppState, View } from "react-native";
import { Link } from "expo-router";
import { Avatar, Skeleton } from "heroui-native";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { env } from "@/utils/env";
import { useEffect, useState } from "react";
import useGreeting from "@/hooks/useGreeting";
import SyncCenter from "@/features/sync/components/SyncCenter";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabsHeader = () => {
  const { data, isLoading, isError, error } = useUserDetails();
  const [greeting, setGreeting] = useState(useGreeting());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setGreeting(useGreeting());
      }
    });

    return () => subscription.remove();
  }, []);

  if (isLoading) return <TabsHeaderSkeleton />;
  if (isError) return <ErrorComponent message={error.message} />;

  const userDetails = data?.[0];

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-white dark:bg-neutral-900 px-5 pb-3 flex flex-row justify-between items-center"
    >
      <Link href="/(main)/profile">
        <View className="flex flex-row items-center gap-3">
          <Avatar size="sm" alt="user-profile">
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
          <View>
            <AppText className="text-xs text-gray-500 dark:text-gray-400">
              {greeting}
            </AppText>
            <AppText
              weight="semibold"
              className="text-2xl leading-tight dark:text-white"
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
      className="bg-white dark:bg-neutral-900 px-5 pb-3 flex flex-row justify-between items-center"
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
