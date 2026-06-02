import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Screen from "@/components/screen";
import CreateClassroomActivityForm from "@/features/classroom/components/CreateClassroomActivityForm";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

const CreateActivityScreen = () => {
  const safeBottom = useScrollBottomInset();
  return (
    <Screen>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ paddingVertical: 12 }}
        style={{ marginBottom: safeBottom }}
        keyboardShouldPersistTaps="handled"
      >
        <CreateClassroomActivityForm />
      </KeyboardAwareScrollView>
    </Screen>
  );
};

export default CreateActivityScreen;
