import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import Screen from "@/components/screen";
import Image from "@/components/Image";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { useGetSubject } from "@/features/oversight/oversight.hooks";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const SubjectDetailsScreen = () => {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { data, isLoading, isError, error } = useGetSubject(subjectId ?? "");
  const navigation = useNavigation();

  const headerTitle = data?.subjectName ?? "";
  useEffect(() => {
    if (!headerTitle) return;
    navigation.setOptions({ headerTitle });
  }, [navigation, headerTitle]);

  if (isLoading) return <SubjectDetailsSkeleton />;
  if (isError)
    return (
      <Screen className="px-2.5 pt-2.5">
        <ErrorFallback message={getApiErrorMessage(error)} />
      </Screen>
    );

  const subjectName = data?.subjectName ?? "";
  const subjectCode = data?.subjectCode ?? "";
  const subjectType = data?.subjectType;
  const subjectPhoto = data?.subjectPhoto;
  const subjectDescription = data?.subjectDescription;
  const instructorName = data?.assignTeacherName ?? "Unassigned";
  const roomNumber = data?.roomNumber || "TBA";
  const showCode = !!subjectCode && subjectCode !== subjectName;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="w-full max-w-3xl mx-auto px-2.5">
          <View className="mt-2.5 mb-5">
            <View className="rounded-2xl overflow-hidden bg-surface-secondary aspect-video">
              <Image
                source={
                  subjectPhoto
                    ? { uri: subjectPhoto }
                    : require("@/assets/placeholder/bg-placeholder.png")
                }
                className="w-full h-full"
                contentFit="cover"
                cachePolicy="disk"
              />
            </View>

            <View className="mt-4">
              <AppText weight="bold" className="text-2xl" numberOfLines={2}>
                {subjectName}
              </AppText>
              {(subjectType || showCode) && (
                <View className="flex-row items-center gap-2 mt-1.5">
                  {subjectType && (
                    <View className="bg-accent-soft px-2.5 py-1 rounded-full">
                      <AppText
                        weight="semibold"
                        className="text-[11px] text-accent uppercase tracking-wider"
                      >
                        {subjectType}
                      </AppText>
                    </View>
                  )}
                  {showCode && (
                    <AppText className="text-sm text-muted">
                      {subjectCode}
                    </AppText>
                  )}
                </View>
              )}
            </View>
          </View>

          <View className="bg-surface-secondary rounded-2xl px-4 mb-5">
            <InfoRow
              icon="UserCircleIcon"
              iconColor="accent"
              iconBgClass="bg-accent-soft"
              label="Instructor"
              value={instructorName}
            />
            <View className="h-px bg-border" />
            <InfoRow
              icon="MapPinIcon"
              iconColor="#10b981"
              iconBgClass="bg-emerald-100 dark:bg-emerald-900/50"
              label="Room"
              value={roomNumber}
            />
          </View>

          {!!subjectDescription && (
            <View className="mb-5">
              <AppText
                weight="semibold"
                className="text-[11px] text-muted uppercase tracking-wider mb-2 px-1"
              >
                Description
              </AppText>
              <View className="bg-surface-secondary rounded-2xl p-4">
                <AppText className="text-sm leading-6">
                  {subjectDescription}
                </AppText>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
};

type InfoRowProps = {
  icon: IconName;
  iconColor: string;
  iconBgClass: string;
  label: string;
  value: string;
};

const InfoRow = ({
  icon,
  iconColor,
  iconBgClass,
  label,
  value,
}: InfoRowProps) => {
  const accentColor = useThemeColor("accent");
  const resolvedColor = iconColor === "accent" ? accentColor : iconColor;
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View
        className={`w-8 h-8 rounded-full items-center justify-center ${iconBgClass}`}
      >
        <Icon name={icon} size={16} color={resolvedColor} />
      </View>
      <View className="flex-1">
        <AppText weight="semibold" className="text-sm" numberOfLines={1}>
          {value}
        </AppText>
        <AppText className="text-[11px] text-muted">{label}</AppText>
      </View>
    </View>
  );
};

const SubjectDetailsSkeleton = () => (
  <Screen>
    <View className="w-full max-w-3xl mx-auto px-2.5 mt-2.5">
      <Skeleton className="rounded-2xl w-full aspect-video" />
      <View className="mt-4 gap-2">
        <Skeleton className="h-7 w-3/4 rounded" />
        <View className="flex-row gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 w-20 rounded" />
        </View>
      </View>

      <View className="bg-surface-secondary rounded-2xl px-4 mt-5">
        <View className="flex-row items-center gap-3 py-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </View>
        </View>
        <View className="h-px bg-border" />
        <View className="flex-row items-center gap-3 py-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </View>
        </View>
      </View>
    </View>
  </Screen>
);

export default SubjectDetailsScreen;
