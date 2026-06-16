import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import BackButton from "@/components/BackButton";
import { Platform, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const SubjectLayout = () => {
  const { subjectId } = useLocalSearchParams();
  const router = useRouter();
  const headerOptions = useThemedHeaderOptions();

  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerTitle: "",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          headerRight: ({ tintColor }) => (
            <Pressable
              onPress={() =>
                router.push(`/(main)/subject/${subjectId}/subject-details`)
              }
              className="w-9 h-9 rounded-full flex justify-center items-center"
            >
              <Icon
                name="InfoIcon"
                color={tintColor}
                style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
              />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="subject-details"
        options={{
          headerTitle: "Subject Details",
        }}
      />
    </Stack>
  );
};

export default SubjectLayout;
