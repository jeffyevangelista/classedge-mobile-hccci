import Screen from "@/components/screen";
import LogoutButton from "@/features/auth/components/LogoutButton";
import ResyncButton from "@/features/auth/components/ResyncButton";
import HeaderComponent from "@/features/profile/components/HeaderComponent";
import ProfileRow from "@/features/profile/components/ProfileRow";
import ThemeToggleButton from "@/features/profile/components/ThemeToggleButton";
import { useUserDetails } from "@/features/profile/profile.hooks";
import useStore from "@/lib/store";
import { Href, Link } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { queryClient } from "@/providers/QueryProvider";

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
    studentOnly: true,
  },
];

const ProfileScreen = () => {
  const authUser = useStore((s) => s.authUser);
  const isStudent = authUser?.role === "Student";
  const userDetails = useUserDetails();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      userDetails.refresh?.(),
      queryClient.invalidateQueries({ stale: true }),
    ]);
    setRefreshing(false);
  }, [userDetails]);

  const visibleNav = profileNav.filter(
    (item) => !item.studentOnly || isStudent,
  );

  const settingsRows: React.ReactNode[] = [
    <ThemeToggleButton key="theme" />,
    ...(__DEV__ ? [<ResyncButton key="resync" />] : []),
    <LogoutButton key="logout" />,
  ];

  return (
    <Screen className="px-2.5">
      <ScreenScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="mx-auto max-w-2xl gap-8 w-full items-center pb-8 grow pt-2.5"
        refreshControl={
          <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <HeaderComponent />

        <View className="w-full gap-6">
          <ProfileSection title="Records">
            {visibleNav.map((item) => (
              <ProfileNavItem key={item.title} {...item} />
            ))}
          </ProfileSection>

          <ProfileSection title="Settings">{settingsRows}</ProfileSection>
        </View>
      </ScreenScrollView>
    </Screen>
  );
};

const ProfileSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const rows = React.Children.toArray(children);
  return (
    <View className="w-full">
      <View className="px-3 mb-2">
        <AppText
          weight="semibold"
          className="text-xs uppercase tracking-wider text-muted"
        >
          {title}
        </AppText>
      </View>
      <Card className="shadow-none rounded-xl overflow-hidden w-full">
        {rows.map((row, idx) => (
          <View
            key={idx}
            className={
              idx < rows.length - 1 ? "border-b border-border" : ""
            }
          >
            {row}
          </View>
        ))}
      </Card>
    </View>
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
