import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import Screen from "@/components/screen";
import LogoutButton from "@/features/auth/components/LogoutButton";
import HeaderComponent from "@/features/profile/components/HeaderComponent";
import { Href, Link } from "expo-router";
import { Card } from "heroui-native";
import { ScrollView, View, Pressable } from "react-native";

type ProfileNavProps = {
  title: string;
  href: Href;
  name: IconName;
};

const profileNav: ProfileNavProps[] = [
  {
    title: "Profile Information",
    href: "/(main)/profile/profile-info",
    name: "IdentificationCardIcon",
  },
  {
    title: "Academic Records",
    href: "/(main)/profile/academic-records",
    name: "BookOpenIcon",
  },
  {
    title: "Financial Records",
    href: "/(main)/profile/financial-records",
    name: "IdentificationBadgeIcon",
  },
  {
    title: "Class Schedule",
    href: "/(main)/profile/class-schedule",
    name: "CalendarDotsIcon",
  },
];

const ProfileScreen = () => {
  return (
    <Screen className="px-2.5 md:px-8">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="flex mx-auto max-w-2xl gap-8 w-full items-center py-8">
          {/* Header Section */}
          <HeaderComponent />

          {/* Navigation Links */}
          <Card className="shadow-none rounded-xl overflow-hidden w-full">
            {profileNav.map((item) => (
              <ProfileNavItem key={item.title} {...item} />
            ))}
            <LogoutButton />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
};

const ProfileNavItem = ({ title, href, name }: ProfileNavProps) => {
  return (
    <Link href={href} asChild>
      <Pressable className="active:opacity-70">
        {({ pressed }) => (
          <View
            className={`flex-row items-center p-3 rounded-2xl border border-transparent`}
          >
            <Icon name={name} size={28} className="text-blue-500" />

            <AppText
              weight="semibold"
              className="text-base sm:text-lg ml-4 flex-1 text-slate-800"
            >
              {title}
            </AppText>

            <Icon
              name={"CaretRightIcon"}
              size={18}
              className="text-slate-400"
            />
          </View>
        )}
      </Pressable>
    </Link>
  );
};

export default ProfileScreen;
