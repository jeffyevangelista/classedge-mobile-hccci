import { Redirect, Stack } from "expo-router";

const ChatLayout = () => {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: {
          fontFamily: "Poppins-SemiBold",
        },
      }}
    >
      <Stack.Screen
        name="new"
        options={{ title: "New message", presentation: "modal" }}
      />
      <Stack.Screen name="[conversationId]" options={{ title: "" }} />
    </Stack>
  );
};

export default ChatLayout;
