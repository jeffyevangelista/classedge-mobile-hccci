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
  useRouter,
  withLayoutContext,
} from "expo-router";
import { useThemeColor } from "heroui-native";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useGetSubject } from "@/features/oversight/oversight.hooks";

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

const SubjectTabsLayout = () => {
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const surface = useThemeColor("surface");
  const border = useThemeColor("border");

  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { data } = useGetSubject(subjectId ?? "");
  const subjectName = data?.subjectName ?? "";

  const navigation = useNavigation();
  const router = useRouter();

  useEffect(() => {
    navigation.setOptions({
      headerTitle: subjectName,
      headerRight: ({ tintColor }: { tintColor?: string }) => (
        <Pressable
          onPress={() => router.push(`/subject/${subjectId}/subject-details`)}
          className="w-9 h-9 rounded-full flex justify-center items-center"
        >
          <Icon
            name="InfoIcon"
            color={tintColor}
            style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
          />
        </Pressable>
      ),
    });
  }, [navigation, subjectName, subjectId, router]);

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
      <MaterialTopTabs.Screen name="students" options={{ title: "Students" }} />
    </MaterialTopTabs>
  );
};

export default SubjectTabsLayout;
