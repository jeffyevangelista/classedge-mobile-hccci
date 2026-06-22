import { LinearGradient } from "expo-linear-gradient";
import { type Href, Link } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import Image from "@/components/Image";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import LogoutButton from "@/features/auth/components/LogoutButton";
import ResyncButton from "@/features/auth/components/ResyncButton";
import HeaderComponent from "@/features/profile/components/HeaderComponent";
import ProfileRow from "@/features/profile/components/ProfileRow";
import ThemeToggleButton from "@/features/profile/components/ThemeToggleButton";
import { useUserDetails } from "@/features/profile/profile.hooks";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";

type ProfileNavProps = {
  title: string;
  href: Href;
  name: IconName;
  studentOnly?: boolean;
  devOnly?: boolean;
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
    devOnly: true,
  },
  {
    title: "Financial Records",
    href: "/(main)/profile/financial-records",
    name: "IdentificationBadgeIcon",
    studentOnly: true,
    devOnly: true,
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
  const { height: screenHeight } = useWindowDimensions();
  const IMAGE_HEIGHT = Math.round(screenHeight * 0.28);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      userDetails.refresh?.(),
      queryClient.invalidateQueries({ stale: true }),
    ]);
    setRefreshing(false);
  }, [userDetails]);

  const refreshControl = useMemo(
    () => <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />,
    [refreshing, onRefresh],
  );

  // Stretchy header (iOS pull-to-refresh pattern): when the user pulls down,
  // translateY cancels the scrollview's push-down so the image's top stays
  // anchored at the viewport top, then scaleY stretches it to fill the
  // pulled-down area. Without the translateY, scale alone leaves a white
  // gap above the photo where the spinner sits.
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const pulled = scrollOffset.value < 0 ? -scrollOffset.value : 0;
    return {
      transformOrigin: "top",
      transform: [
        { translateY: -pulled },
        { scaleY: 1 + pulled / IMAGE_HEIGHT },
      ],
    };
  });

  const visibleNav = profileNav.filter(
    (item) => (!item.studentOnly || isStudent) && (!item.devOnly || __DEV__),
  );

  const settingsRows: React.ReactNode[] = [
    <ThemeToggleButton key="theme" />,
    ...(__DEV__ ? [<ResyncButton key="resync" />] : []),
    <LogoutButton key="logout" />,
  ];

  return (
    <View style={styles.container} className="bg-background">
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={1}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.imageHeader,
            { height: IMAGE_HEIGHT },
            headerAnimatedStyle,
          ]}
          className="bg-default"
        >
          <Image
            source={require("@/assets/bldg.jpg")}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.content} className="bg-background">
          <View className="mx-auto w-full max-w-2xl items-center gap-6">
            <HeaderComponent />

            <View className="w-full gap-6">
              <ProfileSection title="Records">
                {visibleNav.map((item) => (
                  <ProfileNavItem key={item.title} {...item} />
                ))}
              </ProfileSection>

              <ProfileSection title="Settings">{settingsRows}</ProfileSection>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
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
            className={idx < rows.length - 1 ? "border-b border-border" : ""}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageHeader: {
    overflow: "hidden",
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 24,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    minHeight: "100%",
  },
});

export default ProfileScreen;
