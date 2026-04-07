import { View, Text, StyleSheet } from "react-native";
import { useEffect } from "react";
import { useClassSchedule } from "../profile.hooks";
import { FlashList } from "@shopify/flash-list";
import { AppText } from "@/components/AppText";
import { Skeleton, Button, Card, Separator, Chip } from "heroui-native";
import { useToast } from "heroui-native";
import EmptyState from "@/components/EmptyState";

const ClassScheduleList = () => {
  const { toast } = useToast();

  const { data, isError, error, isLoading, refetch, isRefetching } =
    useClassSchedule();

  useEffect(() => {
    if (isError) {
      console.log("Sync error:", error);
      toast.show({
        variant: "danger",
        label: "Error",
        description: "Could not update schedules.",
      });
    }
  }, [isError, error, toast]);

  const classSchedules = data ?? [];

  if (isLoading) {
    return <ClassScheduleSkeleton />;
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text className="dark:text-white">Error loading schedules.</Text>
        <Button onPress={() => refetch()}>
          <Button.Label>Retry</Button.Label>
        </Button>
      </View>
    );
  }

  console.log(JSON.stringify(classSchedules));

  return (
    <FlashList
      className="mx-auto w-full max-w-3xl"
      ListEmptyComponent={
        <EmptyState
          icon="CalendarBlankIcon"
          title="No schedules found"
          description="Your class schedule will appear here"
        />
      }
      keyExtractor={(item, index) =>
        item?.id?.toString() || `schedule-${index}`
      }
      renderItem={({ item }) => {
        const subject = item.subjectId;
        const teacher = subject?.assignTeacherId;
        const schedule = item.schedules?.[0];

        return (
          <Card style={styles.card} className="shadow-none rounded-xl">
            <Card.Body style={styles.cardBody}>
              <View style={styles.header}>
                <AppText className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {subject?.subjectName || "N/A"}
                </AppText>
                <AppText className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {teacher
                    ? `${teacher.firstName} ${teacher.lastName}`
                    : "No teacher assigned"}
                </AppText>
              </View>

              <Separator style={styles.separator} />

              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <AppText
                    className="text-sm font-semibold text-gray-600 dark:text-gray-300"
                    style={{ minWidth: 50 }}
                  >
                    Time:
                  </AppText>
                  <AppText className="text-sm text-gray-500 dark:text-gray-400 flex-1">
                    {schedule?.scheduleStartTime?.slice(0, 5) || "N/A"} -{" "}
                    {schedule?.scheduleEndTime?.slice(0, 5) || "N/A"}
                  </AppText>
                </View>

                <View style={styles.detailRow}>
                  <AppText
                    className="text-sm font-semibold text-gray-600 dark:text-gray-300"
                    style={{ minWidth: 50 }}
                  >
                    Room:
                  </AppText>
                  <AppText className="text-sm text-gray-500 dark:text-gray-400 flex-1">
                    {subject?.roomNumber || "N/A"}
                  </AppText>
                </View>
              </View>

              {schedule && (
                <View style={styles.daysContainer}>
                  {schedule.daysOfWeek &&
                    schedule.daysOfWeek.split(",").map((day) => (
                      <Chip key={day} variant="soft" color="accent">
                        <Chip.Label>{day.trim()}</Chip.Label>
                      </Chip>
                    ))}
                </View>
              )}
            </Card.Body>
          </Card>
        );
      }}
      onRefresh={refetch}
      refreshing={isRefetching}
      data={classSchedules}
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
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
});

const ClassScheduleSkeleton = () => {
  return (
    <View className="mx-auto w-full max-w-3xl gap-3 p-2.5">
      {Array(4)
        .fill(0)
        .map((_, index) => (
          <Card
            key={index}
            style={styles.card}
            className="rounded-xl shadow-none"
          >
            <Card.Body style={styles.cardBody}>
              <View style={styles.header}>
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
              </View>
              <Separator style={styles.separator} />
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Skeleton className="h-4 w-12 rounded" />
                  <Skeleton className="h-4 w-32 rounded" />
                </View>
                <View style={styles.detailRow}>
                  <Skeleton className="h-4 w-12 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                </View>
              </View>
              <View style={styles.daysContainer}>
                <Skeleton className="h-7 w-14 rounded-full" />
                <Skeleton className="h-7 w-14 rounded-full" />
                <Skeleton className="h-7 w-14 rounded-full" />
              </View>
            </Card.Body>
          </Card>
        ))}
    </View>
  );
};

export default ClassScheduleList;
