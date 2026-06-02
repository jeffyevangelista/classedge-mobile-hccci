import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { usePublicLegalDocuments } from "@/features/auth/auth.hooks";
import type { LegalDocument } from "@/features/auth/auth.types";
import { LegalContent } from "@/features/auth/components/LegalContent";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Button, Skeleton } from "heroui-native";
import { useEffect, useMemo } from "react";
import { View } from "react-native";

export type LegalDocType = "EULA" | "PRIVACY" | "NDA";

const DOC_TITLES: Record<LegalDocType, string> = {
  EULA: "End User License Agreement",
  PRIVACY: "Privacy Policy",
  NDA: "Non-Disclosure Agreement",
};

const isLegalDocType = (v: string): v is LegalDocType =>
  v === "EULA" || v === "PRIVACY" || v === "NDA";

const LegalDocumentScreen = () => {
  const { docType: raw } = useLocalSearchParams<{ docType: string }>();
  const navigation = useNavigation();
  const isOffline = useStore((s) => !s.isConnected || !s.isInternetReachable);

  const docType = useMemo<LegalDocType | null>(() => {
    if (!raw) return null;
    const upper = raw.toUpperCase();
    return isLegalDocType(upper) ? upper : null;
  }, [raw]);

  const title = docType ? DOC_TITLES[docType] : "Legal Document";

  useEffect(() => {
    navigation.setOptions({ headerTitle: title });
  }, [navigation, title]);

  const { data, isLoading, isError, error, refetch } =
    usePublicLegalDocuments(true);

  const document = docType ? pickDocument(data, docType) : null;

  return (
    <Screen>
      <ScreenScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 16,
          maxWidth: 768,
          width: "100%",
          alignSelf: "center",
        }}
        showsVerticalScrollIndicator
      >
        {!docType && (
          <View className="items-center py-12 px-4">
            <AppText weight="semibold" className="text-base text-center mb-2">
              Unknown document
            </AppText>
            <AppText className="text-sm text-muted text-center">
              The legal document you're looking for doesn't exist.
            </AppText>
          </View>
        )}

        {docType && isLoading && <BodySkeleton />}

        {docType && !isLoading && isOffline && !document && (
          <View className="items-center py-12 px-4">
            <AppText weight="semibold" className="text-base text-center mb-2">
              You're offline
            </AppText>
            <AppText className="text-sm text-muted text-center mb-4">
              Connect to the internet to view this document.
            </AppText>
            <Button variant="outline" onPress={() => refetch()}>
              <Button.Label>Retry</Button.Label>
            </Button>
          </View>
        )}

        {docType && !isLoading && !isOffline && isError && !document && (
          <View className="items-center py-12 px-4">
            <AppText weight="semibold" className="text-base text-center mb-2">
              Failed to load
            </AppText>
            <AppText className="text-sm text-muted text-center mb-4">
              {getApiErrorMessage(error)}
            </AppText>
            <Button variant="outline" onPress={() => refetch()}>
              <Button.Label>Retry</Button.Label>
            </Button>
          </View>
        )}

        {docType && !isLoading && document && (
          <>
            <AppText className="text-xs text-muted mb-4">
              Version {document.version}
            </AppText>
            <LegalContent content={document.content} />
          </>
        )}
      </ScreenScrollView>
    </Screen>
  );
};

function pickDocument(
  data: ReturnType<typeof usePublicLegalDocuments>["data"],
  docType: LegalDocType,
): LegalDocument | null {
  if (!data) return null;
  if (docType === "EULA") return data.eula;
  if (docType === "PRIVACY") return data.privacy;
  return data.nda;
}

const BodySkeleton = () => (
  <View>
    <Skeleton className="h-3 w-24 rounded mb-4" />
    <View className="gap-2">
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-3/4 rounded" />
      <Skeleton className="h-3 w-full rounded mt-3" />
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-5/6 rounded" />
    </View>
  </View>
);

export default LegalDocumentScreen;
