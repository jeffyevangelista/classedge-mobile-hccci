import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import MSAuthButton from "@/features/auth/components/MSAuthButton";
import { Link, useRouter } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import { useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LoginScreen = () => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallScreen = height < 700;
  const dynamicTopPadding = isSmallScreen
    ? insets.top + 10
    : Math.max(insets.top + 20, height * 0.05);
  const router = useRouter();
  const foregroundColor = useThemeColor("foreground");
  const accentColor = useThemeColor("accent");

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      className="bg-background"
    >
      <View
        className="flex-1 justify-between"
        style={{
          paddingTop: dynamicTopPadding,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 20,
        }}
      >
        {/* logo, title, and auth */}
        <View className="flex-1 items-center justify-center w-full max-w-md mx-auto">
          <View className="items-center mb-48 md:mb-56 lg:mb-64">
            <Image
              source={require("@/assets/logo.png")}
              className={isSmallScreen ? "w-20 h-20" : "w-28 h-28"}
              contentFit="contain"
            />
            <AppText
              weight="semibold"
              className="text-2xl sm:text-3xl mt-4 text-foreground"
            >
              Welcome to Classedge
            </AppText>
            <AppText className="text-xs text-muted text-center mt-1">
              Login to manage your classes and learning
            </AppText>
          </View>

          <View className="w-full gap-4">
            <MSAuthButton />
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              onPress={() => router.push("/(auth)/login-email")}
            >
              <Icon name="EnvelopeIcon" size={28} color={foregroundColor} />
              <Button.Label style={{ color: foregroundColor }}>
                Continue with Email
              </Button.Label>
            </Button>
          </View>
        </View>

        <View className="items-center">
          <AppText className="text-xs text-muted text-center px-4">
            By Continuing, you agree to our{" "}
            <Link style={{ color: accentColor }} href={"/"}>
              EULA
            </Link>{" "}
            and acknowledge{" "}
            <Link style={{ color: accentColor }} href={"/"}>
              Privacy Policy
            </Link>
          </AppText>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
};

export default LoginScreen;
