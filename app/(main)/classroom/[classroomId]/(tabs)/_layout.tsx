import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationEventMap,
  type MaterialTopTabNavigationOptions,
} from "@react-navigation/material-top-tabs";
import type {
  ParamListBase,
  TabNavigationState,
} from "@react-navigation/native";
import { withLayoutContext } from "expo-router";
import { useThemeColor } from "heroui-native";
import { StyleSheet } from "react-native";

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

const ClassroomTabsLayout = () => {
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const surface = useThemeColor("surface");
  const border = useThemeColor("border");

  return (
    <MaterialTopTabs
      backBehavior="none"
      screenOptions={{
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
        tabBarIndicatorStyle: { backgroundColor: accent },
        tabBarStyle: {
          backgroundColor: surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: border,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "Poppins-Medium",
          textTransform: "none",
        },
      }}
    >
      <MaterialTopTabs.Screen name="index" options={{ title: "Materials" }} />
      <MaterialTopTabs.Screen
        name="courseworks"
        options={{ title: "Courseworks" }}
      />
      <MaterialTopTabs.Screen
        name="rapid-grader"
        options={{ title: "RapidGrader" }}
      />
    </MaterialTopTabs>
  );
};

export default ClassroomTabsLayout;
