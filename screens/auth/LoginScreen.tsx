import { useRouter } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import { Pressable, useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import ForcedLogoutNoticeDialog from "@/features/auth/components/ForcedLogoutNoticeDialog";
import MSAuthButton from "@/features/auth/components/MSAuthButton";

const LoginScreen = () => {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallScreen = height < 700;
  const isTablet = width >= 768;
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
      <ForcedLogoutNoticeDialog />
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
              className={
                isTablet
                  ? "w-32 h-32"
                  : isSmallScreen
                    ? "w-24 h-24"
                    : "w-28 h-28"
              }
              contentFit="contain"
            />
            <AppText
              weight="semibold"
              className={`${isTablet ? "text-3xl mt-5" : "text-2xl mt-4"} text-foreground`}
            >
              Welcome to HCCCI
            </AppText>
            <AppText className="text-sm text-muted text-center mt-1">
              Your school day, made easier.
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

        <View className="flex-row flex-wrap items-center justify-center px-4">
          <AppText className="text-xs text-muted">
            By Continuing, you agree to our{" "}
          </AppText>
          <Pressable
            onPress={() => router.push("/(auth)/legal/eula")}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          >
            <AppText className="text-xs" style={{ color: accentColor }}>
              EULA
            </AppText>
          </Pressable>
          <AppText className="text-xs text-muted">
            {" "}
            and acknowledge{" "}
          </AppText>
          <Pressable
            onPress={() => router.push("/(auth)/legal/privacy")}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          >
            <AppText className="text-xs" style={{ color: accentColor }}>
              Privacy Policy
            </AppText>
          </Pressable>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
};

export default LoginScreen;
