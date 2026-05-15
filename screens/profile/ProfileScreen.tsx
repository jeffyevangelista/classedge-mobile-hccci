import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import Screen from "@/components/screen";
import LogoutButton from "@/features/auth/components/LogoutButton";
import ResyncButton from "@/features/auth/components/ResyncButton";
import HeaderComponent from "@/features/profile/components/HeaderComponent";
import ThemeToggleButton from "@/features/profile/components/ThemeToggleButton";
import { Href, Link } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="mx-auto max-w-2xl gap-8 w-full items-center pb-8 grow py-8"
      >
        <HeaderComponent />

        <Card className="shadow-none rounded-xl overflow-hidden w-full">
          {profileNav.map((item) => (
            <ProfileNavItem key={item.title} {...item} />
          ))}
          <ThemeToggleButton />
          <ResyncButton />
          <LogoutButton />
        </Card>
      </ScrollView>
    </Screen>
  );
};

const ProfileNavItem = ({ title, href, name }: ProfileNavProps) => {
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        className="active:opacity-70"
      >
        <View className="flex-row items-center p-3 rounded-2xl border border-transparent">
          <Icon name={name} size={28} color={accentColor} />

          <AppText
            weight="semibold"
            className="text-base sm:text-lg ml-4 flex-1"
          >
            {title}
          </AppText>

          <Icon name="CaretRightIcon" size={18} color={mutedColor} />
        </View>
      </Pressable>
    </Link>
  );
};

export default ProfileScreen;
