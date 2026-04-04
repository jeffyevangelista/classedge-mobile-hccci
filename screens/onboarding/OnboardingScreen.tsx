import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { useCompleteOnboarding, useLogout } from "@/features/auth/auth.hooks";
import { useEffect, useState } from "react";
import { BackHandler, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ControlField, LinkButton, Spinner } from "heroui-native";
import useStore from "@/lib/store";

const LEGAL_VERSION = "1.0";

const OnboardingScreen = () => {
  const { authUser } = useStore();
  const insets = useSafeAreaInsets();

  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const completeOnboardingMutation = useCompleteOnboarding();
  const logoutMutation = useLogout();

  const canContinue = eulaAccepted && privacyAccepted;

  // Trap Android back button — prevent navigating away
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => backHandler.remove();
  }, []);

  const handleContinue = () => {
    if (!canContinue) return;
    completeOnboardingMutation.mutate();
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <View
      className="flex-1 bg-white dark:bg-black"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView
        showsVerticalScrollIndicator
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingBottom: 16,
          alignSelf: "center",
          width: "100%",
          maxWidth: 768,
        }}
      >
        {/* Branding */}
        <View className="items-center pt-8 pb-6">
          <Image
            source={require("@/assets/logo.png")}
            className="w-20 h-20"
            contentFit="contain"
          />
          <AppText weight="semibold" className="text-2xl mt-4 text-center">
            Almost there!
          </AppText>
          <AppText className="text-sm text-gray-500 text-center mt-2 px-8">
            Please review and accept our terms to continue using Classedge.
          </AppText>
        </View>

        {/* Terms & Agreements */}
        <View className="flex-1">
          <AppText weight="bold" className="text-xl">
            Terms & Agreements
          </AppText>

          <AppText className="text-sm text-gray-500 mt-1 mb-4">
            Please review the following agreements (v{LEGAL_VERSION}) before
            continuing.
          </AppText>

          {/* EULA Section */}
          <View className="mb-6">
            <AppText weight="bold" className="text-base mb-2">
              1. End User License Agreement (EULA)
            </AppText>
            <AppText className="text-xs text-gray-500 mb-3">
              This agreement grants you permission to use Classedge and sets the
              rules for what you can and cannot do.
            </AppText>

            <LegalClause title="Grant of License">
              You are granted a limited, revocable, non-exclusive, and
              non-transferable license to use the Classedge app for its intended
              educational purpose.
            </LegalClause>
            <LegalClause title="Restrictions on Use">
              You may not reverse-engineer the app, copy the source code, use it
              to spam others, or use it for any illegal activities.
            </LegalClause>
            <LegalClause title="User-Generated Content">
              Objectionable or offensive content is strictly forbidden.
              Classedge reserves the right to remove such content and ban any
              user who violates this policy.
            </LegalClause>
            <LegalClause title="Termination of License">
              Classedge reserves the right to revoke your access to the app at
              any time if you violate these terms.
            </LegalClause>
            <LegalClause title="Limitation of Liability">
              The app is provided "as-is." Classedge is not liable for crashes,
              data loss due to bugs, or any damage to your device while using
              the app.
            </LegalClause>
          </View>

          {/* Privacy Policy Section */}
          <View className="mb-6">
            <AppText weight="bold" className="text-base mb-2">
              2. Privacy Policy
            </AppText>
            <AppText className="text-xs text-gray-500 mb-3">
              This policy explains what data we collect, how we use it, and how
              we keep it safe.
            </AppText>

            <LegalClause title="Information We Collect">
              We collect information you provide (name, email, and school
              affiliation via Azure OAuth) and information collected
              automatically (device type, operating system, IP address, and app
              usage statistics).
            </LegalClause>
            <LegalClause title="How We Use Your Information">
              To create your account, provide the core features of the LMS, send
              push notifications, and troubleshoot app issues.
            </LegalClause>
            <LegalClause title="Data Sharing with Third Parties">
              We share data with secure cloud database providers, authentication
              providers, and notification/analytics services as needed to
              operate the app.
            </LegalClause>
            <LegalClause title="Data Security">
              We use industry-standard encryption (JWTs, SSL/TLS) and secure
              storage to protect your tokens and school data.
            </LegalClause>
            <LegalClause title="Your Rights">
              You have the right to access your data, correct inaccuracies, or
              request account deletion. Contact support@classedge.com for any
              requests.
            </LegalClause>
          </View>
        </View>
      </ScrollView>

      {/* Checkboxes + buttons pinned to bottom */}
      <View className="border-t border-gray-200 pt-4 px-6 pb-2 self-center w-full max-w-3xl">
        <ControlField
          isSelected={eulaAccepted}
          onSelectedChange={setEulaAccepted}
          className="flex-row items-center gap-3 py-2"
        >
          <ControlField.Indicator variant="checkbox" />
          <AppText className="flex-1 text-xs">
            I agree to the End User License Agreement
          </AppText>
        </ControlField>

        <ControlField
          isSelected={privacyAccepted}
          onSelectedChange={setPrivacyAccepted}
          className="flex-row items-center gap-3 py-2"
        >
          <ControlField.Indicator variant="checkbox" />
          <AppText className="flex-1 text-xs">
            I acknowledge the Privacy Policy
          </AppText>
        </ControlField>

        <View className="mt-4 gap-3">
          <Button
            className="w-full"
            isDisabled={!canContinue || completeOnboardingMutation.isPending}
            onPress={handleContinue}
          >
            {completeOnboardingMutation.isPending ? (
              <Spinner color="white" />
            ) : (
              <Button.Label>Continue</Button.Label>
            )}
          </Button>

          <LinkButton
            className="w-full"
            isDisabled={logoutMutation.isPending}
            onPress={handleLogout}
          >
            {logoutMutation.isPending ? (
              <Spinner />
            ) : (
              <Button.Label>Log Out</Button.Label>
            )}
          </LinkButton>
        </View>
      </View>
    </View>
  );
};

const LegalClause = ({
  title,
  children,
}: {
  title: string;
  children: string;
}) => (
  <View className="mb-3 pl-3 border-l-2 border-primary-200">
    <AppText weight="semibold" className="text-sm mb-1">
      {title}
    </AppText>
    <AppText className="text-xs text-gray-600 leading-5">{children}</AppText>
  </View>
);

export default OnboardingScreen;
