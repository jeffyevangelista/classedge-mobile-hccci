import React, { useMemo } from "react";
import { ScrollView, View, RefreshControl } from "react-native";
import { useUserDetails } from "../profile.hooks";
import { AppText } from "@/components/AppText";
import { Card } from "heroui-native";

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
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useUserDetails();

  // 2. Memoize formatted data to prevent unnecessary string logic on re-renders
  const formattedData = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      fullName:
        `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || "N/A",
    };
  }, [data]);

  if (isLoading) return <AppText className="p-5">Loading...</AppText>;
  if (isError)
    return (
      <AppText className="p-5 text-red-500">
        {error?.message ?? "An error occurred"}
      </AppText>
    );
  if (!formattedData) return <AppText className="p-5">No data found</AppText>;

  return (
    <ScrollView
      className="px-5"
      // 3. Implement Pull-to-Refresh (UX improvement)
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
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
    <Card className="mb-2.5 shadow-none max-w-3xl mx-auto w-full">
      <View className="flex-row justify-between items-center p-3">
        <View>
          <AppText
            weight="regular"
            className="text-muted-foreground text-xs uppercase"
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

export default ProfileInformation;
