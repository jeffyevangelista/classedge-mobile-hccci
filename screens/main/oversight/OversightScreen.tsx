import { useEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import Screen from "@/components/screen";
import OversighCourseList from "@/features/oversight/components/OversighCourseList";
import ArchivedCourseList from "@/features/courses/components/ArchivedCourseList";
import useStore from "@/lib/store";
import type { ViewKey } from "@/features/auth/roleNav";

const OversightScreen = () => {
  const { view = "current" } = useLocalSearchParams<{ view?: ViewKey }>();
  const navigation = useNavigation();
  const { authUser } = useStore();
  const isTimeKeeper = authUser?.role === "Time Keeper";

  useEffect(() => {
    navigation.setOptions({
      headerTitle: view === "archived" ? "Archived Courses" : "Courses",
    });
  }, [navigation, view]);

  if (!isTimeKeeper && view === "archived") {
    return (
      <Screen>
        <ArchivedCourseList />
      </Screen>
    );
  }
  return (
    <Screen>
      <OversighCourseList />
    </Screen>
  );
};

export default OversightScreen;
