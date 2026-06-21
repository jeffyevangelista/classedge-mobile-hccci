import BackButton from "@/components/BackButton";
import { Stack } from "expo-router";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const ProfileLayout = () => {
  const headerOptions = useThemedHeaderOptions();
  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
      }}
    >
      <Stack.Screen
        name="academic-records"
        options={{ title: "Academic Records" }}
      />
      <Stack.Screen
        name="financial-records"
        options={{ title: "Financial Records" }}
      />
      <Stack.Screen
        name="class-schedule"
        options={{ title: "Class Schedule" }}
      />
      <Stack.Screen
        name="profile-info"
        options={{ title: "Profile Information" }}
      />
    </Stack>
  );
};

export default ProfileLayout;
