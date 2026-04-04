import { Stack, useLocalSearchParams } from "expo-router";
import BackButton from "@/components/BackButton";

const SubjectLayout = () => {
  const { subjectId } = useLocalSearchParams();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerTitle: "",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="subject-details" />
    </Stack>
  );
};

export default SubjectLayout;
