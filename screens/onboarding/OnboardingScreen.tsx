import {
  Button,
  ControlField,
  LinkButton,
  Skeleton,
  Spinner,
} from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import {
  useActiveLegalDocuments,
  useCompleteOnboarding,
  useLogout,
} from "@/features/auth/auth.hooks";
import type { LegalDocument } from "@/features/auth/auth.types";
import { LegalContent } from "@/features/auth/components/LegalContent";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { formatDate } from "@/utils/formatDate";

const DOC_LABELS: Record<string, string> = {
  EULA: "End User License Agreement (EULA)",
  PRIVACY: "Privacy Policy",
  NDA: "Non-Disclosure Agreement (NDA)",
};

const OnboardingScreen = () => {
  const { authUser } = useStore();
  const isOffline = useStore((s) => !s.isConnected || !s.isInternetReachable);
  const insets = useSafeAreaInsets();

  const [accepted, setAccepted] = useState(false);

  const {
    data: legalDocs,
    isLoading,
    isError,
    error,
    refetch,
  } = useActiveLegalDocuments();
  const completeOnboardingMutation = useCompleteOnboarding();
  const logoutMutation = useLogout();

  // Trap Android back button — prevent navigating away
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => backHandler.remove();
  }, []);

  const handleContinue = () => {
    if (!accepted) return;
    completeOnboardingMutation.mutate();
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Collect available documents in display order
  const documents: LegalDocument[] = legalDocs
    ? [legalDocs.eula, legalDocs.nda, legalDocs.privacy].filter(
        (doc): doc is LegalDocument => doc !== null && doc !== undefined,
      )
    : [];

  const checkboxLabel = useMemo(() => {
    if (documents.length === 0) return "I have read and agree to the terms";
    const names = documents.map((doc) => DOC_LABELS[doc.docType] ?? doc.title);
    if (names.length === 1) return `I have read and agree to the ${names[0]}`;
    const last = names.pop();
    return `I have read and agree to the ${names.join(", ")} and ${last}`;
  }, [documents]);

  const hasDocuments = documents.length > 0;

  return (
    <View
      className="flex-1 bg-background"
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
          <AppText className="text-sm text-muted text-center mt-2 px-8">
            Please review and accept our terms to continue using HCCCI.
          </AppText>
        </View>

        {/* Terms & Agreements */}
        <View className="flex-1">
          <AppText weight="bold" className="text-xl">
            Terms & Agreements
          </AppText>

          <AppText className="text-sm text-muted mt-1 mb-4">
            Please review the following agreements before continuing.
          </AppText>

          {isLoading && <LegalSkeleton />}

          {!isLoading && isOffline && !hasDocuments && (
            <View className="items-center py-12 px-4">
              <AppText weight="semibold" className="text-base text-center mb-2">
                You're offline
              </AppText>
              <AppText className="text-sm text-muted text-center mb-4">
                An internet connection is required to load the legal agreements.
                Please connect and try again.
              </AppText>
              <Button variant="outline" onPress={() => refetch()}>
                <Button.Label>Retry</Button.Label>
              </Button>
            </View>
          )}

          {!isLoading && !isOffline && isError && (
            <View className="items-center py-12 px-4">
              <AppText weight="semibold" className="text-base text-center mb-2">
                Failed to load agreements
              </AppText>
              <AppText className="text-sm text-muted text-center mb-4">
                {getApiErrorMessage(error)}
              </AppText>
              <Button variant="outline" onPress={() => refetch()}>
                <Button.Label>Retry</Button.Label>
              </Button>
            </View>
          )}

          {!isLoading &&
            hasDocuments &&
            documents.map((doc, index) => (
              <LegalSection key={doc.id} index={index + 1} document={doc} />
            ))}
        </View>
      </ScrollView>

      {/* Checkbox + buttons pinned to bottom */}
      <View className="border-t border-border pt-4 px-6 pb-2 self-center w-full max-w-3xl">
        <ControlField
          isDisabled={completeOnboardingMutation.isPending || !hasDocuments}
          isSelected={accepted}
          onSelectedChange={setAccepted}
          className="flex-row items-center gap-3 py-2"
        >
          <ControlField.Indicator variant="checkbox" />
          <AppText className="flex-1 text-xs">{checkboxLabel}</AppText>
        </ControlField>

        <View className="mt-4 gap-3">
          <Button
            className="w-full"
            isDisabled={
              !accepted || completeOnboardingMutation.isPending || !hasDocuments
            }
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
            isDisabled={
              logoutMutation.isPending || completeOnboardingMutation.isPending
            }
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

const LegalSkeleton = () => (
  <View className="gap-6">
    {[1, 2, 3].map((i) => (
      <View key={i} className="mb-6">
        <Skeleton className="h-5 w-48 rounded mb-2" />
        <Skeleton className="h-3 w-24 rounded mb-3" />
        <View className="pl-3 border-l-2 border-border gap-2">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </View>
      </View>
    ))}
  </View>
);

const LegalSection = ({
  index,
  document,
}: {
  index: number;
  document: LegalDocument;
}) => {
  const label = DOC_LABELS[document.docType] ?? document.title;

  return (
    <View className="mb-6">
      <AppText weight="bold" className="text-base mb-1">
        {index}. {label}
      </AppText>
      <AppText className="text-xs text-muted mb-3">
        Version {document.version} · Effective{" "}
        {formatDate(document.effectiveDate)}
      </AppText>

      <View className="pl-3 border-l-2 border-border">
        <LegalContent content={document.content} />
      </View>
    </View>
  );
};

export default OnboardingScreen;
