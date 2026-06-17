import { useEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import Screen from "@/components/screen";
import ArchivedCourseList from "@/features/courses/components/ArchivedCourseList";
import TeachingCourseList from "@/features/teaching/components/TeachingCourseList";
import type { ViewKey } from "@/features/auth/roleNav";

const TeachingScreen = () => {
  const { view = "current" } = useLocalSearchParams<{ view?: ViewKey }>();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerTitle: view === "archived" ? "Archived Courses" : "Teaching",
    });
  }, [navigation, view]);

  if (view === "archived") {
    return (
      <Screen>
        <ArchivedCourseList />
      </Screen>
    );
  }
  return (
    <Screen>
      <TeachingCourseList />
    </Screen>
  );
};

export default TeachingScreen;
