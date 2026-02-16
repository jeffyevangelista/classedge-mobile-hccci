import { View, Text, StyleSheet } from "react-native";
import React, { useCallback } from "react";
import { useClassSchedule } from "../profile.hooks";
import { FlashList } from "@shopify/flash-list";
import { AppText } from "@/components/AppText";
import { useNetInfo } from "@react-native-community/netinfo";
import { Spinner, Button, Card, Separator, Chip } from "heroui-native"; // Assuming heroui-native has a Button
import { useToast } from "heroui-native";

const ClassScheduleList = () => {
  const netInfo = useNetInfo();
  const { toast } = useToast();

  const {
    data,
    isError,
    error,
    isLoading,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useClassSchedule();

  const loadMore = useCallback(async () => {
    // Only attempt to fetch more if online
    if (netInfo.isConnected && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [netInfo.isConnected, hasNextPage, isFetchingNextPage, fetchNextPage]);

  React.useEffect(() => {
    if (isError) {
      console.log("Sync error:", error);
      toast.show({
        variant: "danger",
        label: "Error",
        description: "Could not update schedules.",
      });
    }
  }, [isError, error]);

  // --- Handling Initial Loading ---
  const classSchedules = data?.pages.flatMap((page) => page.results) ?? [];

  if (isLoading && classSchedules.length === 0) {
    return (
      <View style={styles.center}>
        <Spinner size="lg" />
      </View>
    );
  }

  // --- Handling Errors ---
  if (isError && classSchedules.length === 0) {
    return (
      <View style={styles.center}>
        <Text>Error loading schedules.</Text>
        <Button onPress={() => refetch()}>
          <Button.Label>Retry</Button.Label>
        </Button>
      </View>
    );
  }

  // --- Footer Component for Offline/Loading More ---
  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <Spinner style={{ padding: 20 }} />;
    }

    if (hasNextPage && !netInfo.isConnected) {
      return (
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>
            You are offline. Cannot load more schedules.
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <FlashList
      className="mx-auto w-full max-w-3xl"
      keyExtractor={(item) => item.id.toString()}
      data={classSchedules}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Card.Body style={styles.cardBody}>
            <View style={styles.header}>
              <AppText style={styles.subjectName}>{item.subject_name}</AppText>
              <AppText style={styles.teacherName}>
                {item.assign_teacher}
              </AppText>
            </View>

            <Separator style={styles.separator} />

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <AppText style={styles.label}>Time:</AppText>
                <AppText style={styles.value}>
                  {item.schedule_start_time} - {item.schedule_end_time}
                </AppText>
              </View>

              <View style={styles.detailRow}>
                <AppText style={styles.label}>Room:</AppText>
                <AppText style={styles.value}>{item.room}</AppText>
              </View>
            </View>

            <View style={styles.daysContainer}>
              {item.days_of_week.map((day) => (
                <Chip key={day} variant="soft" color="accent">
                  <Chip.Label>{day}</Chip.Label>
                </Chip>
              ))}
            </View>
          </Card.Body>
        </Card>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      // --- Pull to Refresh ---
      onRefresh={refetch}
      refreshing={isRefetching}
    />
  );
};

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

export default ClassScheduleList;
