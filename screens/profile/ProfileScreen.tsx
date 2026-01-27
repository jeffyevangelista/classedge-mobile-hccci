import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Screen from "@/components/screen";
import LogoutButton from "@/features/auth/components/LogoutButton";
import { Href, Link } from "expo-router";
import { Avatar } from "heroui-native";
import {
  BookOpenIcon,
  CalendarDotsIcon,
  IdentificationBadgeIcon,
  IdentificationCardIcon,
} from "phosphor-react-native";
import { ComponentType } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { ChevronRightIcon } from "react-native-heroicons/outline";

type ProfileNavProps = {
  title: string;
  href: Href;
  icon: ComponentType<any>;
};

const profileNav: ProfileNavProps[] = [
  {
    title: "Profile Information",
    href: "/(main)/profile/profile-info",
    icon: IdentificationCardIcon,
  },
  {
    title: "Academic Records",
    href: "/(main)/profile/academic-records",
    icon: BookOpenIcon,
  },
  {
    title: "Financial Records",
    href: "/(main)/profile/financial-records",
    icon: IdentificationBadgeIcon,
  },
  {
    title: "Class Schedule",
    href: "/(main)/profile/class-schedule",
    icon: CalendarDotsIcon,
  },
];

const ProfileScreen = () => {
  return (
    <Screen className="px-4 md:px-8">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="flex mx-auto max-w-2xl gap-8 w-full items-center py-8">
          {/* Header Section */}
          <View className="items-center">
            <View className="p-1 border-2 border-blue-600 rounded-full">
              <Avatar
                // Using Tailwind classes for sizing instead of JS logic for better performance
                className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40"
                alt="John Doe"
              >
                <Avatar.Image
                  source={{ uri: "https://example.com/avatar.jpg" }}
                />
                <Avatar.Fallback>JD</Avatar.Fallback>
              </Avatar>
            </View>

            <View className="items-center mt-6">
              <AppText
                weight="bold"
                className="text-2xl sm:text-3xl text-slate-900"
              >
                John Doe
              </AppText>
              <AppText className="text-sm sm:text-base text-gray-500">
                john.doe@university.edu
              </AppText>
              <AppText
                weight="semibold"
                className="text-xs sm:text-sm text-blue-600 mt-1 tracking-widest"
              >
                ID: 1000000000000000
              </AppText>
            </View>
          </View>

          {/* Navigation Links */}
          <View className="w-full gap-2">
            {profileNav.map((item) => (
              <ProfileNavItem key={item.title} {...item} />
            ))}
          </View>

          <View className="mt-4 w-full">
            <LogoutButton />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

const ProfileNavItem = ({ title, href, icon }: ProfileNavProps) => {
  return (
    <Link href={href} asChild>
      <Pressable className="active:opacity-70">
        {({ pressed }) => (
          <View
            className={`flex-row items-center p-4 rounded-2xl border border-transparent 
            ${pressed ? "bg-blue-50/50" : "bg-slate-50"}`}
          >
            <View className="p-2.5 bg-white rounded-xl shadow-sm">
              <Icon as={icon} size={22} className="text-blue-600" />
            </View>

            <AppText
              weight="semibold"
              className="text-base sm:text-lg ml-4 flex-1 text-slate-800"
            >
              {title}
            </AppText>

            <Icon as={ChevronRightIcon} size={18} className="text-slate-400" />
          </View>
        )}
      </Pressable>
    </Link>
  );
};

export default ProfileScreen;
