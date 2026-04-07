import TabIcon from "@/components/TabIcon";
import { useNotificationCount } from "@/features/notifications/notifications.hooks";
import useStore from "@/lib/store";
import { Tabs } from "expo-router";
import { Platform, View } from "react-native";

const TabsLayout = () => {
  const { authUser, isConnected, isInternetReachable } = useStore();
  const { data } = useNotificationCount();
  const isOffline = !isConnected || !isInternetReachable;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        safeAreaInsets={isOffline ? { bottom: 0 } : undefined}
        // safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          headerShadowVisible: false,
          animation: "shift",
          headerTitleAlign: "left",
          headerTitleStyle: {
            fontFamily: "Poppins-SemiBold",
            fontSize: Platform.OS === "ios" ? 28 : 32,
            color: "#000",
          },
          tabBarLabelStyle: {
            fontFamily: "Poppins-Medium",
          },
          tabBarStyle: {
            elevation: 0,
            shadowOpacity: 0,
            borderTopWidth: 0,
          },
          headerStyle: {
            elevation: 0,
            shadowOpacity: 0,
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
              <TabIcon focused={focused} color={color} IconElement="BellIcon" />
            ),
            headerTitle: "Notifications",
            tabBarLabel: "Notifications",
          }}
        />
      </Tabs>
    </View>
  );
};

export default TabsLayout;
