import { View, Text, useWindowDimensions, StyleSheet } from "react-native";
import { AppText } from "@/components/AppText";
import OTPVerificationForm from "@/features/auth/components/OTPVerificationForm";
import Screen from "@/components/screen";
import { useRouter } from "expo-router";
import MailSent from "@/assets/illustrations/forgot-password/mail-sent.svg";
import useStore from "@/lib/store";

const OTPVerificationScreen = () => {
  const { height, width } = useWindowDimensions();
  const { email } = useStore.getState();
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
        <MailSent
          width={width * 0.7}
          height={height * 0.2}
          style={styles.image}
        />
        <AppText
          className="text-center text-2xl text-gray-500 mb-2"
          weight="semibold"
        >
          Please check you email
        </AppText>
        <AppText className="text-center text-gray-500 mb-8">
          We've sent a 6-digit verification code to{" "}
          <AppText className="text-center font-semibold">{email}</AppText>
        </AppText>

        <OTPVerificationForm />
      </View>
    </Screen>
  );
};

export default OTPVerificationScreen;

const styles = StyleSheet.create({
  image: { marginBottom: 40 },
});
