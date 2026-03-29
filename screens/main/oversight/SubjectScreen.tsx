import Screen from "@/components/screen";
import CourseworkList from "@/features/oversight/components/CourseworkList";
import LessonList from "@/features/oversight/components/LessonList";
import StudentList from "@/features/oversight/components/StudentList";
import { Tabs } from "heroui-native";
import { useState } from "react";

export default function TabsExample() {
  const [activeTab, setActiveTab] = useState("materials");

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
            <Tabs.Trigger value="students">
              <Tabs.Label>Students</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.ScrollView>
        </Tabs.List>

        <Tabs.Content value="materials" className="flex-1">
          <LessonList />
        </Tabs.Content>

        <Tabs.Content value="courseworks" className="flex-1">
          <CourseworkList />
        </Tabs.Content>

        <Tabs.Content value="students">
          <StudentList />
        </Tabs.Content>
      </Tabs>
    </Screen>
  );
}
