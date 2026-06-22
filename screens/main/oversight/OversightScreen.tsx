import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";
import Screen from "@/components/screen";
import type { ViewKey } from "@/features/auth/roleNav";
import ArchivedCourseList from "@/features/courses/components/ArchivedCourseList";
import OversighCourseList from "@/features/oversight/components/OversighCourseList";
import useStore from "@/lib/store";

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
