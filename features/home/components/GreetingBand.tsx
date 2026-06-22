import { Avatar, Skeleton } from "heroui-native";
import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import HeaderDecor from "@/features/home/components/HeaderDecor";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { getGreeting } from "@/utils/getGreeting";
import { toTitleCase } from "@/utils/toTitleCase";

const GreetingBand = () => {
  const { data, isLoading, error } = useUserDetails();
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setGreeting(getGreeting());
      }
    });
    return () => subscription.remove();
  }, []);

  const userDetails = data?.[0];
  const firstName = userDetails?.firstName;

  return (
    <View className="bg-surface px-5 pt-2 pb-3 rounded-b-3xl overflow-hidden flex flex-row items-center gap-3">
      <HeaderDecor dots />
      {isLoading ? (
        <Skeleton className="w-10 h-10 rounded-full" />
      ) : (
        <Avatar size="md" alt="user-profile" className="border border-border">
          <AttachmentAvatarImage path={userDetails?.studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>
      )}
      <View className="gap-1">
        <AppText className="text-[10px] uppercase tracking-wider text-muted">
          {greeting}
        </AppText>
        {isLoading ? (
          <Skeleton className="h-5 w-28 rounded" />
        ) : (
          <AppText
            weight="semibold"
            className="text-lg leading-tight text-foreground"
          >
            {firstName
              ? toTitleCase(firstName.split(" ")[0])
              : error
                ? "—"
                : ""}
          </AppText>
        )}
      </View>
    </View>
  );
};

export default GreetingBand;
