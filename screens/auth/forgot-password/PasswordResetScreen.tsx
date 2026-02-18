import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/AppText";
import PasswordResetForm from "@/features/auth/components/PasswordResetForm";
import { useWindowDimensions } from "react-native";
import Screen from "@/components/screen";
import EnterPassword from "@/assets/illustrations/forgot-password/enter-password.svg";
import { Button } from "heroui-native";

const PasswordResetScreen = () => {
  const { height, width } = useWindowDimensions();
  const verticalPadding = height > 800 ? 64 : 32;

  return (
    <Screen>
      <View
        style={{
          paddingVertical: verticalPadding,
          paddingBottom: verticalPadding / 2,
        }}
        className="flex-1 items-center justify-start px-6"
      >
        <EnterPassword
          width={width * 0.7}
          height={height * 0.2}
          style={styles.image}
        />
        <AppText
          className="text-center text-2xl text-gray-500 mb-2"
          weight="semibold"
        >
          Set a New Password
        </AppText>

        <AppText className="text-center text-gray-500 mb-8">
          Create a new, more secure password to protect your account
        </AppText>
        <PasswordResetForm />
        <Button size={height > 800 ? "lg" : "md"} variant="ghost">
          <Button.Label>Cancel</Button.Label>
        </Button>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  image: { marginBottom: 40 },
});

export default PasswordResetScreen;
