import { View, Text } from "react-native";
import React from "react";
import Screen from "@/components/screen";
import OversighCourseList from "@/features/oversight/components/OversighCourseList";

const OversightScreen = () => {
  return (
    <Screen>
      <OversighCourseList />
    </Screen>
  );
};

export default OversightScreen;
