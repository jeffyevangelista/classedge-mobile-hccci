import React, { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { useUserDetails } from "../profile.hooks";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import NoDataFallback from "@/components/NoDataFallback";
import { Card, Skeleton } from "heroui-native";
import { toTitleCase } from "@/utils/toTitleCase";

// 1. Move static mapping outside to prevent re-creation on every render
const INFO_FIELDS = [
  { label: "Full Name", key: "fullName" },
  { label: "Phone Number", key: "phoneNumber" },
  { label: "Date of Birth", key: "dateOfBirth" },
  { label: "Gender", key: "gender" },
  { label: "Nationality", key: "nationality" },
  { label: "Address", key: "address" },
  { label: "Id number", key: "idNumber" },
] as const;

const ProfileInformation = () => {
  const { data, isLoading, error, refresh } = useUserDetails();

  // 2. Memoize formatted data to prevent unnecessary string logic on re-renders
  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return null;
    return {
      ...data[0],
      fullName:
        toTitleCase(
          `${data[0]?.firstName ?? ""} ${data[0]?.lastName ?? ""}`.trim(),
        ) || "N/A",
      dateOfBirth: data[0]?.dateOfBirth
        ? new Date(data[0].dateOfBirth).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null,
    };
  }, [data]);

  if (isLoading) return <ProfileInformationSkeleton />;
  if (error)
    return (
      <ErrorComponent
        message={error?.message ?? "An error occurred"}
        onRetry={() => refresh?.()}
      />
    );
  if (!formattedData)
    return (
      <NoDataFallback
        title="No profile data"
        description="Your profile information is not available"
        onRefetch={() => refresh?.()}
      />
    );

  return (
    <ScrollView
      className="p-2.5"
      refreshControl={
        <RefreshIndicator refreshing={false} onRefresh={() => refresh?.()} />
      }
    >
      {INFO_FIELDS.map((field) => (
        <InFormationItem
          key={field.label}
          label={field.label}
          value={
            String(
              formattedData[field.key as keyof typeof formattedData] ?? "",
            ) || null
          }
        />
      ))}
    </ScrollView>
  );
};

// 4. Memoize the child component to prevent unnecessary re-renders
const InFormationItem = React.memo(
  ({ label, value }: { label: string; value: string | null | undefined }) => (
    <Card className="mb-2.5 shadow-none rounded-xl max-w-3xl mx-auto w-full">
      <View className="flex-row justify-between items-center p-3">
        <View>
          <AppText
            weight="regular"
            className="text-gray-500 dark:text-gray-400 text-xs uppercase"
          >
            {label}
          </AppText>
          <AppText weight="semibold" className="text-lg">
            {value || "—"}
          </AppText>
        </View>
      </View>
    </Card>
  ),
);

const ProfileInformationSkeleton = () => {
  return (
    <View className="p-2.5">
      {Array(7)
        .fill(0)
        .map((_, index) => (
          <Card
            key={index}
            className="mb-2.5 shadow-none rounded-xl max-w-3xl mx-auto w-full"
          >
            <View className="flex-row justify-between items-center p-3">
              <View className="gap-1.5">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-5 w-40 rounded" />
              </View>
            </View>
          </Card>
        ))}
    </View>
  );
};

export default ProfileInformation;
