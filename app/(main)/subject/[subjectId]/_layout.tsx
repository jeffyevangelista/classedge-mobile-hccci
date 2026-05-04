import { Stack, useLocalSearchParams } from "expo-router";
import BackButton from "@/components/BackButton";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const SubjectLayout = () => {
  const { subjectId } = useLocalSearchParams();
  const headerOptions = useThemedHeaderOptions();
  return (
    <Stack
      screenOptions={{
        ...headerOptions,
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
