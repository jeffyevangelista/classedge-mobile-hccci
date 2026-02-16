import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Screen from "@/components/screen";
import LogoutButton from "@/features/auth/components/LogoutButton";
import HeaderComponent from "@/features/profile/components/HeaderComponent";
import { Href, Link } from "expo-router";
import { Avatar } from "heroui-native";
import {
  BookOpenIcon,
  CalendarDotsIcon,
  CaretRightIcon,
  IdentificationBadgeIcon,
  IdentificationCardIcon,
} from "phosphor-react-native";
import { ComponentType } from "react";
import { ScrollView, View, Pressable } from "react-native";

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
          <HeaderComponent />

          {/* Navigation Links */}
          <View className="w-full">
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
            className={`flex-row items-center p-4 rounded-2xl border border-transparent`}
          >
            <View className="p-2 bg-white rounded-xl shadow-sm">
              <Icon as={icon} size={22} className="text-blue-500" />
            </View>

            <AppText
              weight="semibold"
              className="text-base sm:text-lg ml-4 flex-1 text-slate-800"
            >
              {title}
            </AppText>

            <Icon as={CaretRightIcon} size={18} className="text-slate-400" />
          </View>
        )}
      </Pressable>
    </Link>
  );
};

export default ProfileScreen;
