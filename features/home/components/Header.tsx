import { AppState, View } from "react-native";
import { Link } from "expo-router";
import { Avatar } from "heroui-native";
import { AppText } from "@/components/AppText";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { env } from "@/utils/env";
import { useEffect, useState } from "react";
import useGreeting from "@/hooks/useGreeting";

const Header = () => {
  const { data, isLoading, isError, error } = useUserDetails();
  const [greeting, setGreeting] = useState(useGreeting());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setGreeting(useGreeting()); // Re-check the time
      }
    });

    return () => subscription.remove();
  }, []);

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>{error.message}</AppText>;

  const userDetails = data?.[0];

  return (
    <View className="px-5 flex flex-row justify-between items-center">
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
            <AppText className="text-gray-500">{greeting},</AppText>
            <AppText weight="semibold" className="text-2xl leading-tight">
              {userDetails?.firstName
                ? userDetails.firstName.split(" ")[0]
                : ""}
            </AppText>
          </View>
        </View>
      </Link>
    </View>
  );
};

export default Header;
