import { useEffect, useState } from "react";
import Screen from "@/components/screen";
import { Button, Tabs } from "heroui-native";
import LessonList from "@/features/classroom/components/LessonList";
import CourseworkList from "@/features/classroom/components/CourseworkList";
import ClassroomActivitiyList from "@/features/classroom/components/ClassroomActivitiyList";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { db } from "@/powersync/system";

const ClassroomScreen = () => {
  const [activeTab, setActiveTab] = useState("materials");
  const { classroomId } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    const fetchClassroomDetails = async () => {
      const classroom = await db.query.coursesTable.findFirst({
        where: (course, { eq }) => eq(course.id, Number(classroomId)),
        columns: { subjectName: true },
      });

      if (classroom) {
        navigation.setOptions({ headerTitle: classroom.subjectName });
      }
    };

    fetchClassroomDetails();
  }, [classroomId, navigation]);

  return (
    <Screen>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        variant="primary"
        className="flex-1 w-full max-w-3xl mx-auto px-2.5"
      >
        <Tabs.List className="justify-center">
          <Tabs.ScrollView contentContainerClassName="flex-1 justify-center">
            <Tabs.Indicator />
            <Tabs.Trigger value="materials">
              <Tabs.Label>Materials</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="courseworks">
              <Tabs.Label>Courseworks</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="rapid-grader">
              <Tabs.Label>RapidGrader</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.ScrollView>
        </Tabs.List>

        <Tabs.Content value="materials" className="flex-1">
          <LessonList />
        </Tabs.Content>

        <Tabs.Content value="courseworks" className="flex-1">
          <CourseworkList />
        </Tabs.Content>

        <Tabs.Content value="rapid-grader" className="flex-1 gap-2">
          <Button
            className="ml-auto"
            onPress={() => {
              router.push(`/classroom/${classroomId}/create-activity`);
            }}
          >
            <Button.Label>Create Activity</Button.Label>
          </Button>
          <ClassroomActivitiyList />
        </Tabs.Content>
      </Tabs>
    </Screen>
  );
};

export default ClassroomScreen;
