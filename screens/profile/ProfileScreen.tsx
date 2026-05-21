import Screen from "@/components/screen";
import LogoutButton from "@/features/auth/components/LogoutButton";
import ResyncButton from "@/features/auth/components/ResyncButton";
import HeaderComponent from "@/features/profile/components/HeaderComponent";
import ProfileRow from "@/features/profile/components/ProfileRow";
import ThemeToggleButton from "@/features/profile/components/ThemeToggleButton";
import useStore from "@/lib/store";
import { Href, Link } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { ScrollView, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";

type ProfileNavProps = {
  title: string;
  href: Href;
  name: IconName;
  studentOnly?: boolean;
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
    studentOnly: true,
  },
  {
    title: "Financial Records",
    href: "/(main)/profile/financial-records",
    name: "IdentificationBadgeIcon",
    studentOnly: true,
  },
  {
    title: "Class Schedule",
    href: "/(main)/profile/class-schedule",
    name: "CalendarDotsIcon",
  },
];

const ProfileScreen = () => {
  const authUser = useStore((s) => s.authUser);
  const isStudent = authUser?.role === "Student";

  const visibleNav = profileNav.filter(
    (item) => !item.studentOnly || isStudent,
  );

  return (
    <Screen className="px-2.5">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="mx-auto max-w-2xl gap-8 w-full items-center pb-8 grow py-8"
      >
        <HeaderComponent />

        <Card className="shadow-none rounded-xl overflow-hidden w-full">
          {visibleNav.map((item) => (
            <ProfileNavItem key={item.title} {...item} />
          ))}
          <ThemeToggleButton />
          {__DEV__ && <ResyncButton />}
          <LogoutButton />
        </Card>
      </ScrollView>
    </Screen>
  );
};

const ProfileNavItem = ({ title, href, name }: ProfileNavProps) => {
  const mutedColor = useThemeColor("muted");

  return (
    <Link href={href} asChild>
      <ProfileRow
        icon={name}
        label={title}
        trailing={
          <View>
            <Icon name="CaretRightIcon" size={18} color={mutedColor} />
          </View>
        }
      />
    </Link>
  );
};

export default ProfileScreen;
