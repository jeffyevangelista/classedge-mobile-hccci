import { useEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import Screen from "@/components/screen";
import ArchivedCourseList from "@/features/courses/components/ArchivedCourseList";
import TeachingCourseList from "@/features/teaching/components/TeachingCourseList";
import { useTeachingOrbitCourses } from "@/features/teaching/teaching.hooks";
import type { ViewKey } from "@/features/auth/roleNav";

const TITLE_BY_VIEW: Record<ViewKey, string> = {
  current: "Teaching",
  archived: "Archived Courses",
  coil: "COIL",
  hali: "HALI",
  cte: "CTE",
};

const TeachingScreen = () => {
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
      <TeachingCourseList />
    </Screen>
  );
};

const OrbitListShell = ({ flag }: { flag: "coil" | "hali" | "cte" }) => {
  const q = useTeachingOrbitCourses(flag);
  return <TeachingCourseList query={q} />;
};

export default TeachingScreen;
