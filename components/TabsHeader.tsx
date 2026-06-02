import { AppState, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Avatar, Skeleton } from "heroui-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { useEffect, useState } from "react";
import { getGreeting } from "@/utils/getGreeting";
import { toTitleCase } from "@/utils/toTitleCase";
import SyncCenter from "@/features/sync/components/SyncCenter";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabsHeader = () => {
  const { data, isLoading, error } = useUserDetails();
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

  const userDetails = data?.[0];
  const firstName = userDetails?.firstName;

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-surface px-5 pb-2 flex flex-row justify-between items-center"
    >
      <Link href="/(main)/profile" asChild>
        <Pressable className="flex flex-row items-center gap-3 active:opacity-80">
          <Avatar size="md" alt="user-profile" className="border border-border">
            <AttachmentAvatarImage path={userDetails?.studentPhoto} />
            <AvatarFallbackImage />
          </Avatar>
          <View>
            <AppText className="text-[11px] text-muted tracking-wider">
              {greeting}
            </AppText>
            <AppText
              weight="semibold"
              className="text-2xl leading-tight text-foreground"
            >
              {firstName
                ? toTitleCase(firstName.split(" ")[0])
                : error
                  ? "—"
                  : ""}
            </AppText>
          </View>
        </Pressable>
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
      className="bg-surface px-5 pb-2 flex flex-row justify-between items-center"
    >
      <View className="flex flex-row items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
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
