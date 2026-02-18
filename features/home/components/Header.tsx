import { View, Text } from "react-native";
import { Link } from "expo-router";
import { Avatar } from "heroui-native";
import { AppText } from "@/components/AppText";
import SyncCenter from "../../sync/components/SyncCenter";
import { useUserDetails } from "../../profile/profile.hooks";
import { env } from "@/utils/env";

const Header = () => {
  const { data: userDetails } = useUserDetails();

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
            <AppText className="text-gray-500">Good Morning,</AppText>
            <AppText weight="semibold" className="text-2xl leading-tight">
              {userDetails?.firstName
                ? userDetails.firstName.split(" ")[0].charAt(0).toUpperCase() +
                  userDetails.firstName.split(" ")[0].slice(1).toLowerCase()
                : ""}
            </AppText>
          </View>
        </View>
      </Link>
    </View>
  );
};

export default Header;
