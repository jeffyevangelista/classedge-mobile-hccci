import { StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText } from "@/components/AppText";
import { Button } from "heroui-native";
import { useRouter } from "expo-router";
import Screen from "@/components/screen";
import Success from "@/assets/illustrations/forgot-password/success.svg";

const ResetSuccessScreen = () => {
  const { height, width } = useWindowDimensions();
  const verticalPadding = height > 800 ? 64 : 32;
  const router = useRouter();

  return (
    <Screen>
      <View
        style={{
          paddingVertical: verticalPadding,
          paddingBottom: verticalPadding / 2,
        }}
        className="flex-1 items-center justify-start px-6 border"
      >
        <Success
          width={width * 0.7}
          height={height * 0.2}
          style={styles.image}
        />
        <AppText
          className="mb-2 text-center text-2xl text-gray-500"
          weight="semibold"
        >
          Reset Password Success
        </AppText>
        <AppText className="text-gray-500 text-center mb-8 max-w-md self-center">
          You can now use your new password to login to your account.
        </AppText>

        <Button onPress={() => router.push("/(auth)/login")}>
          <Button.Label>Go to Login</Button.Label>
        </Button>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  image: { marginBottom: 40 },
});

export default ResetSuccessScreen;
