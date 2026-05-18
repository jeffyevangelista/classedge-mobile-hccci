import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "heroui-native";
import Screen from "@/components/screen";
import ClassroomActivitiyList from "@/features/classroom/components/ClassroomActivitiyList";

export default function RapidGraderTab() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const router = useRouter();

  return (
    <Screen className="gap-2 px-2.5">
      <Button
        className="ml-auto"
        onPress={() => router.push(`/classroom/${classroomId}/create-activity`)}
      >
        <Button.Label>Create Activity</Button.Label>
      </Button>
      <ClassroomActivitiyList />
    </Screen>
  );
}
