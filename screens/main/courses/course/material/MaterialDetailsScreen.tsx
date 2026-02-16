import { View, Text, ScrollView, Image } from "react-native";
import React from "react";
import { useCourseMaterial } from "@/features/courses/courses.hooks";
import { useLocalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { Card } from "heroui-native";
import { API_BASE_URL } from "@/utils/env";

const MaterialDetailsScreen = () => {
  const { materialId } = useLocalSearchParams();
  const { data, isLoading, isError, error } = useCourseMaterial(
    materialId as string,
  );

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>Error: {error.message}</AppText>;
  if (!data) return <AppText>No data found</AppText>;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Screen>
      <ScrollView className="flex-1 p-4">
        <View className="gap-4">
          <Card className="p-4">
            <AppText weight="bold" className="text-2xl mb-2">
              {data.fileName}
            </AppText>

            {data.description && (
              <View className="mt-4">
                <AppText weight="semibold" className="text-lg mb-2">
                  Description
                </AppText>
                <AppText className="text-foreground-secondary">
                  {data.description}
                </AppText>
              </View>
            )}

            <View className="mt-4 gap-2">
              <View className="flex-row justify-between">
                <AppText weight="semibold">Start Date:</AppText>
                <AppText>{formatDate(data.startDate)}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">End Date:</AppText>
                <AppText>{formatDate(data.endDate)}</AppText>
              </View>
            </View>
          </Card>

          {data.file && (
            <Card className="p-4">
              <AppText weight="semibold" className="text-lg mb-2">
                Attached File
              </AppText>
              <Image
                source={{ uri: `${API_BASE_URL}/media/${data.file}` }}
                style={{ width: "100%", height: 300, borderRadius: 8 }}
                resizeMode="contain"
              />
            </Card>
          )}

          {data.url && (
            <Card className="p-4">
              <AppText weight="semibold" className="text-lg mb-2">
                URL
              </AppText>
              <AppText className="text-primary">{data.url}</AppText>
            </Card>
          )}

          {data.iframeCode && (
            <Card className="p-4">
              <AppText weight="semibold" className="text-lg mb-2">
                Embedded Content
              </AppText>
              <AppText className="text-foreground-secondary">
                Iframe content available
              </AppText>
            </Card>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
};

export default MaterialDetailsScreen;
