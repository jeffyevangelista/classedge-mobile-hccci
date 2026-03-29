import { View, Text, ScrollView } from "react-native";
import React from "react";
import Screen from "@/components/screen";
import CreateClassroomActivityForm from "@/features/classroom/components/CreateClassroomActivityForm";

const CreateActivityScreen = () => {
  return (
    <Screen>
      <ScrollView>
        <CreateClassroomActivityForm />
      </ScrollView>
    </Screen>
  );
};

export default CreateActivityScreen;
