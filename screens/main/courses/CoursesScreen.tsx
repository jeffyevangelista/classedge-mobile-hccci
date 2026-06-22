import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";
import Screen from "@/components/screen";
import type { ViewKey } from "@/features/auth/roleNav";
import ArchivedCourseList from "@/features/courses/components/ArchivedCourseList";
import CourseList from "@/features/courses/components/CourseList";
import { useOrbitCourses } from "@/features/courses/orbit.hooks";

const TITLE_BY_VIEW: Record<ViewKey, string> = {
  current: "My Courses",
  archived: "Archived Courses",
  coil: "COIL",
  hali: "HALI",
  cte: "CTE",
};

const CoursesScreen = () => {
  const { view = "current" } = useLocalSearchParams<{ view?: ViewKey }>();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerTitle: TITLE_BY_VIEW[view] });
  }, [navigation, view]);

  if (view === "archived") {
    return (
      <Screen>
        <ArchivedCourseList />
      </Screen>
    );
  }
  if (view === "coil" || view === "hali" || view === "cte") {
    return (
      <Screen>
        <OrbitListShell flag={view} />
      </Screen>
    );
  }
  return (
    <Screen>
      <CourseList />
    </Screen>
  );
};

const OrbitListShell = ({ flag }: { flag: "coil" | "hali" | "cte" }) => {
  const q = useOrbitCourses(flag);
  return <CourseList query={q} />;
};

export default CoursesScreen;
