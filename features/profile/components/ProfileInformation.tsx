import React, { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Avatar, Card, Skeleton } from "heroui-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { ErrorComponent } from "@/components/ErrorComponent";
import NoDataFallback from "@/components/NoDataFallback";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Icon } from "@/components/Icon";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { formatDate } from "@/features/calendar/components/date-formatter";
import useStore from "@/lib/store";
import { toTitleCase } from "@/utils/toTitleCase";
import { useUserDetails } from "../profile.hooks";
import { useProfilePhotoActionSheet } from "@/features/profile/useProfilePhotoActionSheet";

type FieldKey =
  | "fullName"
  | "phoneNumber"
  | "dateOfBirth"
  | "gender"
  | "nationality"
  | "address"
  | "idNumber";

type FieldDef = { label: string; key: FieldKey };

const PERSONAL_FIELDS: FieldDef[] = [
  { label: "Date of Birth", key: "dateOfBirth" },
  { label: "Gender", key: "gender" },
  { label: "Nationality", key: "nationality" },
];

const CONTACT_FIELDS: FieldDef[] = [
  { label: "Phone Number", key: "phoneNumber" },
  { label: "Address", key: "address" },
  { label: "ID Number", key: "idNumber" },
];

const ProfileInformation = () => {
  const { data, isLoading, error, refresh } = useUserDetails();
  const role = useStore((s) => s.authUser?.role);
  const [refreshing, setRefreshing] = useState(false);
  const { requestEdit, portal } = useProfilePhotoActionSheet();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const row = data[0];
    return {
      ...row,
      fullName:
        toTitleCase(`${row?.firstName ?? ""} ${row?.lastName ?? ""}`.trim()) ||
        null,
      dateOfBirth: row?.dateOfBirth ? formatDate(row.dateOfBirth) : null,
    };
  }, [data]);

  // PowerSync/Drizzle returns the integer PK as a string here (e.g. "14",
  // not 14). Coerce before handing it to the editor — the EditTarget type
  // wants a number, and the SQL UPDATE / Connector URL both work fine with
  // the numeric form.
  const profileIdNum = Number(formattedData?.id ?? NaN);
  const openEditor = Number.isFinite(profileIdNum)
    ? () =>
        requestEdit({
          profileId: profileIdNum,
          currentPhoto: formattedData?.studentPhoto ?? null,
        })
    : undefined;

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

  const fullName =
    formattedData.fullName ??
    (toTitleCase(
      `${formattedData.firstName ?? ""} ${formattedData.lastName ?? ""}`.trim(),
    ) ||
      "User");

  return (
    <>
      <ScreenScrollView
        className="p-2.5"
        refreshControl={
          <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerClassName="gap-6 pb-8"
      >
        <ProfileHero
          fullName={fullName}
          role={role}
          idNumber={formattedData.idNumber ?? null}
          photo={formattedData.studentPhoto}
          onEditPhoto={openEditor}
        />
        <FieldSection
          title="Personal"
          fields={PERSONAL_FIELDS}
          data={formattedData}
        />
        <FieldSection
          title="Contact"
          fields={CONTACT_FIELDS}
          data={formattedData}
        />
      </ScreenScrollView>
      {portal}
    </>
  );
};

const ProfileHero = ({
  fullName,
  role,
  idNumber,
  photo,
  onEditPhoto,
}: {
  fullName: string;
  role?: string | null;
  idNumber: string | null;
  photo?: string | null;
  onEditPhoto?: () => void;
}) => (
  <View className="items-center max-w-3xl mx-auto w-full">
    <Pressable
      onPress={onEditPhoto}
      disabled={!onEditPhoto}
      accessibilityRole="button"
      accessibilityLabel="Edit profile photo"
      className="rounded-full active:opacity-80"
    >
      <View>
        <Avatar
          alt={fullName}
          size="lg"
          className="w-32 h-32 border-2 border-border"
        >
          <AttachmentAvatarImage path={photo ?? undefined} />
          <AvatarFallbackImage />
        </Avatar>
        {onEditPhoto ? (
          <View
            accessibilityElementsHidden
            className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-accent items-center justify-center border-2 border-background"
          >
            <Icon name="CameraIcon" size={20} color="white" />
          </View>
        ) : null}
      </View>
    </Pressable>
    <AppText weight="bold" className="text-xl mt-3 text-center">
      {fullName}
    </AppText>
    <View className="flex-row items-center gap-1.5 mt-1.5 flex-wrap justify-center">
      {role ? (
        <View className="px-2.5 py-0.5 rounded-full bg-accent-soft">
          <AppText weight="semibold" className="text-[11px] text-accent">
            {role}
          </AppText>
        </View>
      ) : null}
      {idNumber ? (
        <View className="px-2.5 py-0.5 rounded-full bg-surface-secondary border border-border">
          <AppText weight="semibold" className="text-[11px] text-muted">
            ID · {idNumber}
          </AppText>
        </View>
      ) : null}
    </View>
  </View>
);

const FieldSection = ({
  title,
  fields,
  data,
}: {
  title: string;
  fields: FieldDef[];
  data: Record<string, unknown>;
}) => (
  <View className="max-w-3xl mx-auto w-full">
    <View className="px-3 mb-2">
      <AppText
        weight="semibold"
        className="text-xs uppercase tracking-wider text-muted"
      >
        {title}
      </AppText>
    </View>
    <Card className="shadow-none rounded-xl overflow-hidden">
      {fields.map((field, idx) => {
        const raw = data[field.key];
        const value =
          raw === null || raw === undefined || raw === "" ? null : String(raw);
        return (
          <View
            key={field.label}
            className={idx < fields.length - 1 ? "border-b border-border" : ""}
          >
            <InformationItem label={field.label} value={value} />
          </View>
        );
      })}
    </Card>
  </View>
);

const InformationItem = React.memo(
  ({ label, value }: { label: string; value: string | null }) => (
    <View
      accessibilityLabel={`${label}: ${value ?? "Not provided"}`}
      className={`p-3 ${value ? "" : "opacity-60"}`}
    >
      <AppText
        weight="regular"
        className="text-muted text-xs uppercase tracking-wider"
      >
        {label}
      </AppText>
      {value ? (
        <AppText weight="semibold" className="text-base mt-0.5">
          {value}
        </AppText>
      ) : (
        <AppText className="text-xs text-muted mt-0.5">Not provided</AppText>
      )}
    </View>
  ),
);
InformationItem.displayName = "InformationItem";

const ProfileInformationSkeleton = () => {
  const personalCount = PERSONAL_FIELDS.length;
  const contactCount = CONTACT_FIELDS.length;
  return (
    <View className="p-2.5 gap-6">
      <View className="items-center max-w-3xl mx-auto w-full">
        <Skeleton className="w-32 h-32 rounded-full" />
        <Skeleton className="h-6 w-40 rounded mt-3" />
        <View className="flex-row gap-1.5 mt-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </View>
      </View>
      {[personalCount, contactCount].map((count, sectionIdx) => (
        <View key={sectionIdx} className="max-w-3xl mx-auto w-full">
          <View className="px-3 mb-2">
            <Skeleton className="h-3 w-16 rounded" />
          </View>
          <Card className="shadow-none rounded-xl overflow-hidden">
            {Array(count)
              .fill(0)
              .map((_, index) => (
                <View
                  key={index}
                  className={index < count - 1 ? "border-b border-border" : ""}
                >
                  <View className="p-3 gap-1.5">
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-5 w-40 rounded" />
                  </View>
                </View>
              ))}
          </Card>
        </View>
      ))}
    </View>
  );
};

export default ProfileInformation;
