import TabIcon from "@/components/TabIcon";
import TabsHeader from "@/components/TabsHeader";
import { useThemeColor } from "heroui-native";
import { useNetworkBannerHeight } from "@/features/network/NetworkBannerContext";
import { useNotificationCount } from "@/features/notifications/notifications.hooks";
import useStore from "@/lib/store";
import { Tabs } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabsLayout = () => {
  const { authUser, isConnected, isInternetReachable } = useStore();
  const { data } = useNotificationCount();
  const { bannerHeight } = useNetworkBannerHeight();
  const insets = useSafeAreaInsets();
  const isOffline = !isConnected || !isInternetReachable;
  const isBannerVisible = bannerHeight > 0;

  const surfaceColor = useThemeColor("surface");
  const borderColor = useThemeColor("border");
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");

  const shouldHidePadding = isOffline || isBannerVisible;
  const targetPadding = shouldHidePadding ? 0 : insets.bottom;
  const bottomPadding = useSharedValue(targetPadding);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      bottomPadding.value = targetPadding;
      isFirstRender.current = false;
      return;
    }
    bottomPadding.value = withTiming(targetPadding, {
      duration: 300,
      easing: shouldHidePadding
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
    });
  }, [shouldHidePadding, insets.bottom]);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    paddingBottom: bottomPadding.value,
    backgroundColor: surfaceColor,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TabsHeader />
      <View style={{ flex: 1 }}>
        <Tabs
          safeAreaInsets={{ bottom: 0 }}
          screenOptions={{
            headerShown: false,
            headerShadowVisible: false,
            animation: "shift",
            headerTitleAlign: "left",
            headerTitleStyle: {
              fontFamily: "Poppins-SemiBold",
              fontSize: Platform.OS === "ios" ? 28 : 32,
            },
            tabBarLabelStyle: {
              fontFamily: "Poppins-Medium",
            },
            tabBarActiveTintColor: accentColor,
            tabBarInactiveTintColor: mutedColor,
            tabBarStyle: {
              elevation: 0,
              shadowOpacity: 0,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: borderColor,
              backgroundColor: surfaceColor,
            },
            headerStyle: {
              elevation: 0,
              shadowOpacity: 0,
              backgroundColor: surfaceColor,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              tabBarIcon: ({ focused, color }) => (
                <TabIcon
                  focused={focused}
                  color={color}
                  IconElement="HouseIcon"
                />
              ),
              headerTitle: "Good Morning, User!",
              tabBarLabel: "Home",
              headerShown: false,
            }}
          />

          <Tabs.Protected guard={authUser?.role === "Teacher"}>
            <Tabs.Screen
              name="teaching"
              options={{
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon
                    focused={focused}
                    color={color}
                    IconElement="ChalkboardTeacherIcon"
                  />
                ),
                headerTitle: "Teaching",
                tabBarLabel: "Teaching",
              }}
            />
          </Tabs.Protected>

          <Tabs.Protected guard={authUser?.role === "Student"}>
            <Tabs.Screen
              name="courses"
              options={{
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon
                    focused={focused}
                    color={color}
                    IconElement="BookOpenIcon"
                  />
                ),
                tabBarLabel: "Courses",
              }}
            />
          </Tabs.Protected>

          <Tabs.Protected
            guard={
              authUser?.role === "Program Head" ||
              authUser?.role === "Academic Director" ||
              authUser?.role === "Time Keeper"
            }
          >
            <Tabs.Screen
              name="oversight"
              options={{
                tabBarIcon: ({ focused, color }) => (
                  <TabIcon
                    focused={focused}
                    color={color}
                    IconElement="BinocularsIcon"
                  />
                ),
                tabBarLabel: "Oversight",
              }}
            />
          </Tabs.Protected>

          <Tabs.Screen
            name="calendar"
            options={{
              tabBarIcon: ({ focused, color }) => (
                <TabIcon
                  focused={focused}
                  color={color}
                  IconElement="CalendarBlankIcon"
                />
              ),
              headerTitle: "Calendar",
              tabBarLabel: "Calendar",
            }}
          />

          <Tabs.Screen
            name="notifications"
            options={{
              tabBarBadge:
                (data?.[0]?.count ?? 0) > 0 ? data?.[0]?.count : undefined,
              tabBarIcon: ({ focused, color }) => (
                <TabIcon
                  focused={focused}
                  color={color}
                  IconElement="BellIcon"
                />
              ),
              headerTitle: "Notifications",
              tabBarLabel: "Notifications",
            }}
          />
        </Tabs>
      </View>
    </Animated.View>
  );
};

export default TabsLayout;
