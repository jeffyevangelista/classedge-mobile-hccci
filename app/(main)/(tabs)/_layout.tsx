import TabIcon from "@/components/TabIcon";
import { useNotificationCount } from "@/features/notifications/notifications.hooks";

import SyncCenter from "@/features/sync/components/SyncCenter";
import { colors } from "@/utils/colors";
import { Tabs } from "expo-router";
import {
  BellIcon,
  BookOpenIcon,
  CalendarBlankIcon,
  HouseIcon,
} from "phosphor-react-native";
import { Platform, View } from "react-native";

const TabsLayout = () => {
  const { data } = useNotificationCount();

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        animation: "shift",
        headerTitleAlign: "left",
        tabBarInactiveTintColor: colors.primary[400],
        headerTitleStyle: {
          fontFamily: "Poppins-SemiBold",
          fontSize: Platform.OS === "ios" ? 28 : 32,
          color: "#000",
        },
        tabBarActiveTintColor: colors.primary[500],
        headerTintColor: colors.primary[500],
        tabBarLabelStyle: {
          fontFamily: "Poppins-Medium",
        },
        tabBarStyle: {
          elevation: 0,
          shadowOpacity: 0,
          borderTopWidth: 0,
          // bottom: isConnected ? 0 : 45,
        },
        headerStyle: {
          elevation: 0,
          shadowOpacity: 0,
          backgroundColor: colors.backgroundColor,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} IconElement={HouseIcon} />
          ),
          headerTitle: "Good Morning, User!",
          tabBarLabel: "Home",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          headerRight: () => (
            <View className="mr-2">
              <SyncCenter />
            </View>
          ),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              IconElement={BookOpenIcon}
            />
          ),
          headerTitle: "Courses",
          tabBarLabel: "Courses",
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              IconElement={CalendarBlankIcon}
            />
          ),
          headerTitle: "Calendar",
          tabBarLabel: "Calendar",
          headerStyle: {
            backgroundColor: "white",
          },
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          tabBarBadge: data?.count && data.count > 0 ? data.count : undefined,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} IconElement={BellIcon} />
          ),
          headerTitle: "Notifications",
          tabBarLabel: "Notifications",
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
