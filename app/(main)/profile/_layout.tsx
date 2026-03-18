import BackButton from "@/components/BackButton";
import { colors } from "@/utils/colors";
import { Stack } from "expo-router";

const ProfileLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
          title: "Profile",
        }}
      />
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
