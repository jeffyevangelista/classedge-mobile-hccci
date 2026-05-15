import Screen from "@/components/screen";
import LoginForm from "@/features/auth/components/LoginForm";
import { useWindowDimensions } from "react-native";

const LoginEmailScreen = () => {
  const { height } = useWindowDimensions();
  const dynamicTopPadding = height * 0.1;
  return (
    <Screen
      className="items-center"
      style={{
        paddingTop: dynamicTopPadding,
      }}
    >
      <LoginForm />
    </Screen>
  );
};

export default LoginEmailScreen;
