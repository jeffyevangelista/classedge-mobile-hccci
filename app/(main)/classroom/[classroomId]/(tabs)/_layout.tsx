import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import {
  useLocalSearchParams,
  useNavigation,
  withLayoutContext,
} from "expo-router";
import { useThemeColor } from "heroui-native";
import { useEffect } from "react";
import { useClassroom } from "@/features/classroom/classroom.hooks";

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

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
          borderBottomWidth: 1,
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
