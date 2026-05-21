import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Screen from "@/components/screen";
import CreateClassroomActivityForm from "@/features/classroom/components/CreateClassroomActivityForm";

const CreateActivityScreen = () => {
  return (
    <Screen>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <CreateClassroomActivityForm />
      </KeyboardAwareScrollView>
    </Screen>
  );
};

export default CreateActivityScreen;
