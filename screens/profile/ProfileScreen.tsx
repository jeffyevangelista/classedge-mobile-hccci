import BackButton from "@/components/BackButton";
import LogoutButton from "@/features/auth/components/LogoutButton";
import ResyncButton from "@/features/auth/components/ResyncButton";
import HeaderComponent from "@/features/profile/components/HeaderComponent";
import ProfileRow from "@/features/profile/components/ProfileRow";
import ThemeToggleButton from "@/features/profile/components/ThemeToggleButton";
import { useUserDetails } from "@/features/profile/profile.hooks";
import useStore from "@/lib/store";
import { Href, Link } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { Icon, type IconName } from "@/components/Icon";
import { queryClient } from "@/providers/QueryProvider";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import { toTitleCase } from "@/utils/toTitleCase";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";

const NAV_HEIGHT = 56;

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
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const IMAGE_HEIGHT = Math.round(screenHeight * 0.28);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const bottomInset = useScrollBottomInset(16);

  const surfaceColor = useThemeColor("surface");
  const foregroundColor = useThemeColor("foreground");
  const borderColor = useThemeColor("border");

  const user = userDetails.data?.[0];
  const fullName = user
    ? toTitleCase(`${user.firstName} ${user.lastName}`)
    : "";

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

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transformOrigin: "top",
    transform: [
      {
        scale: interpolate(
          scrollOffset.value,
          [-IMAGE_HEIGHT, 0],
          [1.5, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const navBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [0, IMAGE_HEIGHT],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const navTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [IMAGE_HEIGHT, IMAGE_HEIGHT + 30],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const floatingBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [0, IMAGE_HEIGHT],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const visibleNav = profileNav.filter(
    (item) => !item.studentOnly || isStudent,
  );

  const settingsRows: React.ReactNode[] = [
    <ThemeToggleButton key="theme" />,
    ...(__DEV__ ? [<ResyncButton key="resync" />] : []),
    <LogoutButton key="logout" />,
  ];

  return (
    <View style={styles.container} className="bg-background">
      {/* Animated Navigation Bar */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top,
          height: insets.top + NAV_HEIGHT,
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: surfaceColor,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: borderColor,
            },
            navBgStyle,
          ]}
        />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
          }}
        >
          <View>
            <Animated.View
              style={[styles.floatingBtn, floatingBtnStyle]}
              className="bg-white/70 dark:bg-black/50"
            />
            <View className="w-10 h-10 rounded-full flex justify-center items-center">
              <BackButton tintColor={foregroundColor} />
            </View>
          </View>
          <Animated.View
            style={[{ flex: 1, marginHorizontal: 4 }, navTitleStyle]}
          >
            <AppText
              weight="semibold"
              className="text-lg text-foreground"
              numberOfLines={1}
            >
              {fullName}
            </AppText>
          </Animated.View>
          {/* Right slot kept empty for symmetry; no action button on profile */}
          <View className="w-10 h-10" />
        </View>
      </View>

      {/* Parallax ScrollView */}
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={1}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        style={{ marginBottom: bottomInset }}
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
  floatingBtn: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
  },
});

export default ProfileScreen;
