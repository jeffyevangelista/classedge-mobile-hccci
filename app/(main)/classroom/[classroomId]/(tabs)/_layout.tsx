import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationEventMap,
  type MaterialTopTabNavigationOptions,
} from "@react-navigation/material-top-tabs";
import type {
  ParamListBase,
  TabNavigationState,
} from "@react-navigation/native";
import {
  useLocalSearchParams,
  useNavigation,
  withLayoutContext,
} from "expo-router";
import { useThemeColor } from "heroui-native";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { useClassroom } from "@/features/classroom/classroom.hooks";

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

const ClassroomTabsLayout = () => {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const navigation = useNavigation();
  const { data } = useClassroom(classroomId);
  const subjectName = data?.[0]?.subjectName;

  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const surface = useThemeColor("surface");
  const border = useThemeColor("border");

  useEffect(() => {
    if (subjectName) {
      navigation.getParent()?.setOptions({ headerTitle: subjectName });
    }
  }, [subjectName, navigation]);

  return (
    <MaterialTopTabs
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
