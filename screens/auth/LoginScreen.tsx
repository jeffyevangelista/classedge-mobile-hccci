import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import MSAuthButton from "@/features/auth/components/MSAuthButton";
import { colors } from "@/utils/colors";
import { Link, useRouter } from "expo-router";
import { Button } from "heroui-native";
import { useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EnvelopeIcon } from "phosphor-react-native";

const LoginScreen = () => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallScreen = height < 700;
  const dynamicTopPadding = isSmallScreen
    ? insets.top + 10
    : Math.max(insets.top + 20, height * 0.05);
  const router = useRouter();

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.backgroundColor }}
      contentContainerStyle={{
        flexGrow: 1,
      }}
    >
      <View
        className="flex-1 justify-between"
        style={{
          paddingTop: dynamicTopPadding,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 20,
          backgroundColor: colors.backgroundColor,
        }}
      >
        <View className="flex-1 items-center justify-center w-full max-w-md mx-auto">
          <View className={`items-center ${isSmallScreen ? "mb-6" : "mb-10"}`}>
            <Image
              source={require("@/assets/logo.png")}
              className={
                isSmallScreen ? "w-20 h-20" : "w-28 h-28" // Made slightly larger for better branding
              }
              contentFit="contain"
            />
            <AppText weight="semibold" className="text-2xl sm:text-3xl mt-4">
              Welcome to Classedge
            </AppText>
            <AppText className="text-xs text-gray-500 text-center mt-1">
              Login to manage your classes and learning
            </AppText>
          </View>

          <View className="w-full gap-4">
            <MSAuthButton />

            <View className="flex-row items-center justify-center my-2">
              <AppText className="text-xs text-gray-400 mx-3">OR</AppText>
            </View>

            <Button
              className="w-full"
              variant="outline"
              size="lg"
              onPress={() => router.push("/(auth)/login-email")}
            >
              <Icon as={EnvelopeIcon} size={28} />
              <Button.Label className="text-primary-500">
                Continue with Email
              </Button.Label>
            </Button>
          </View>
        </View>

        <View className="items-center">
          <AppText className="text-xs text-gray-500 text-center px-4">
            By Continuing, you agree to our{" "}
            <Link style={{ color: colors.primary[500] }} href={"/"}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link style={{ color: colors.primary[500] }} href={"/"}>
              Privacy Policy
            </Link>
          </AppText>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
};

export default LoginScreen;
