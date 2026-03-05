import { View, Text, StyleSheet, ScrollView } from "react-native";
import React, { memo, useCallback, useEffect } from "react";
import { usePendingAssessments } from "../courses.hooks";
import { AppText } from "@/components/AppText";
import { FlashList } from "@shopify/flash-list";
import { useNetInfo } from "@react-native-community/netinfo";
import { Button, Card, Spinner, useToast } from "heroui-native";
import { BookOpenIcon } from "phosphor-react-native";
import { Icon } from "@/components/Icon";
import { Assessment } from "../courses.types";

const PendingAssessmentList = ({
  subjectId,
  horizontal,
}: {
  subjectId: string | null;
  horizontal: boolean;
}) => {
  const netInfo = useNetInfo();
  const { toast } = useToast();
  const { data, isError, error, isLoading, refetch, isRefetching } =
    usePendingAssessments(subjectId);

  // useEffect(() => {
  //   if (isError) {
  //     console.log("Sync error:", error);
  //     toast.show({
  //       variant: "danger",
  //       label: "Error",
  //       description: "Could not update schedules.",
  //     });
  //   }
  // }, [isError, error]);

  // if (isLoading && data.length === 0) {
  //   return (
  //     <View style={styles.center}>
  //       <Spinner size="lg" />
  //     </View>
  //   );
  // }

  // if (isError && data.length === 0) {
  //   return (
  //     <View style={styles.center}>
  //       <AppText>Error loading schedules.</AppText>
  //       <Button onPress={() => refetch()}>
  //         <Button.Label>Retry</Button.Label>
  //       </Button>
  //     </View>
  //   );
  // }

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>{error.message}</AppText>;

  if (!data || data.length === 0) return <AppText>No Assessments</AppText>;

  // const renderFooter = () => {
  //   if (isFetchingNextPage) {
  //     return <Spinner style={{ padding: 20 }} />;
  //   }

  //   if (hasNextPage && !netInfo.isConnected) {
  //     return (
  //       <View style={styles.footerInfo}>
  //         <AppText style={styles.footerText}>
  //           You are offline. Cannot load more schedules.
  //         </AppText>
  //       </View>
  //     );
  //   }

  //   return null;
  // };

  return (
    <View>
      {/* <FlashList
        className="h-24"
        ListEmptyComponent={<AppText>No Assessments</AppText>}
        data={assessments}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        onRefresh={refetch}
        refreshing={isRefetching}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => <AssessmentItem item={item} />}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      /> */}
      <ScrollView
        horizontal={horizontal}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
        }}
      >
        {Array.isArray(data) &&
          data.map((assessment) => (
            <AssessmentItem key={assessment.id} item={assessment} />
          ))}
      </ScrollView>
    </View>
  );
};

export default PendingAssessmentList;

const AssessmentItem = memo(({ item }: { item: Assessment }) => (
  <Card className=" w-72 md:w-80 lg:w-96 mr-3 shadow-none">
    <Card.Body className="flex flex-row items-center gap-2.5">
      <View className="p-2 bg-emerald-100 rounded-full">
        <Icon as={BookOpenIcon} size={24} className="text-emerald-500" />
      </View>
      <View className="flex-1">
        <AppText numberOfLines={1} weight="semibold">
          {item.activity_name}
        </AppText>
        <AppText className="text-gray-500 text-sm">{item.start_time}</AppText>
      </View>
    </Card.Body>
  </Card>
));

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    marginBottom: 12,
  },
  cardBody: {
    gap: 12,
  },
  header: {
    gap: 4,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  teacherName: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  separator: {
    marginVertical: 4,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    minWidth: 50,
  },
  value: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  dayChip: {
    marginRight: 0,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  footerInfo: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    color: "gray",
    textAlign: "center",
  },
});
