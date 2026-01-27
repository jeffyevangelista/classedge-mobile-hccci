import Screen from "@/components/screen";
import { Button, FormField, Tabs, TextField } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

const AnimatedContentContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <Animated.View
    entering={FadeIn.duration(200)}
    exiting={FadeOut.duration(200)}
    className="gap-6"
  >
    {children}
  </Animated.View>
);

export default function TabsExample() {
  const [activeTab, setActiveTab] = useState("general");

  const [showSidebar, setShowSidebar] = useState(true);
  const [accountActivity, setAccountActivity] = useState(true);
  const [name, setName] = useState("");

  return (
    <Screen>
      <Tabs value={activeTab} onValueChange={setActiveTab} variant="pill">
        <Tabs.List>
          <Tabs.ScrollView>
            <Tabs.Indicator />
            <Tabs.Trigger value="general">
              <Tabs.Label>General</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="notifications">
              <Tabs.Label>Notifications</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="profile">
              <Tabs.Label>Profile</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.ScrollView>
        </Tabs.List>

        <Animated.View
          layout={LinearTransition.duration(200)}
          className="px-4 py-6 border border-border rounded-xl"
        >
          <Tabs.Content value="general">
            <AnimatedContentContainer>
              <FormField
                isSelected={showSidebar}
                onSelectedChange={setShowSidebar}
              >
                <FormField.Indicator variant="checkbox" />
                <View className="flex-1">
                  <FormField.Label>Show sidebar</FormField.Label>
                  <FormField.Description>
                    Display the sidebar navigation panel
                  </FormField.Description>
                </View>
              </FormField>
            </AnimatedContentContainer>
          </Tabs.Content>

          <Tabs.Content value="notifications">
            <AnimatedContentContainer>
              <FormField
                isSelected={accountActivity}
                onSelectedChange={setAccountActivity}
              >
                <FormField.Indicator variant="checkbox" />
                <View className="flex-1">
                  <FormField.Label>Account activity</FormField.Label>
                  <FormField.Description>
                    Notifications about your account activity
                  </FormField.Description>
                </View>
              </FormField>
            </AnimatedContentContainer>
          </Tabs.Content>

          <Tabs.Content value="profile">
            <AnimatedContentContainer>
              <TextField isRequired>
                <TextField.Label>Name</TextField.Label>
                <TextField.Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your full name"
                />
              </TextField>
              <Button size="sm" className="self-start">
                <Button.Label>Update profile</Button.Label>
              </Button>
            </AnimatedContentContainer>
          </Tabs.Content>
        </Animated.View>
      </Tabs>
    </Screen>
  );
}
