import { View, Text } from "react-native";
import React from "react";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { Avatar } from "heroui-native";
import { AppText } from "@/components/AppText";
import { API_BASE_URL } from "@/utils/env";

const HeaderComponent = () => {
  const { data: userDetails } = useUserDetails();
  return (
    <View className="items-center">
      <View className="p-1 border-3 border-blue-500  rounded-full">
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
                ? { uri: `${API_BASE_URL}/media/${userDetails.studentPhoto}` }
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
        <AppText weight="bold" className="text-2xl sm:text-3xl text-slate-900">
          {userDetails?.firstName} {userDetails?.lastName}
        </AppText>
        <AppText className="text-sm sm:text-base text-gray-500">
          {userDetails?.userId?.email}
        </AppText>
        <AppText weight="semibold" className="text-xs sm:text-sm">
          {userDetails?.idNumber}
        </AppText>
      </View>
    </View>
  );
};

export default HeaderComponent;
