// import { View, Text, StyleSheet } from "react-native";
// import { useCallback, useEffect } from "react";
// import { useClassSchedule } from "../profile.hooks";
// import { FlashList } from "@shopify/flash-list";
// import { AppText } from "@/components/AppText";
// import { useNetInfo } from "@react-native-community/netinfo";
// import { Spinner, Button, Card, Separator, Chip } from "heroui-native"; // Assuming heroui-native has a Button
// import { useToast } from "heroui-native";

// const ClassScheduleList = () => {
//   const netInfo = useNetInfo();
//   const { toast } = useToast();

//   const {
//     data,
//     isError,
//     error,
//     isLoading,
//     refetch,
//     isRefetching,
//     hasNextPage,
//     isFetchingNextPage,
//     fetchNextPage,
//   } = useClassSchedule();

//   const loadMore = useCallback(async () => {
//     // Only attempt to fetch more if online
//     if (netInfo.isConnected && hasNextPage && !isFetchingNextPage) {
//       fetchNextPage();
//     }
//   }, [netInfo.isConnected, hasNextPage, isFetchingNextPage, fetchNextPage]);

//   useEffect(() => {
//     if (isError) {
//       console.log("Sync error:", error);
//       toast.show({
//         variant: "danger",
//         label: "Error",
//         description: "Could not update schedules.",
//       });
//     }
//   }, [isError, error]);

//   // --- Handling Initial Loading ---
//   const classSchedules =
//     data?.pages?.flatMap((page) => page?.results || []) ?? [];
//   console.log({ classSchedules, data });

//   if (isLoading && classSchedules.length === 0) {
//     return (
//       <View style={styles.center}>
//         <Spinner size="lg" />
//       </View>
//     );
//   }

//   // --- Handling Errors ---
//   if (isError && classSchedules.length === 0) {
//     return (
//       <View style={styles.center}>
//         <Text>Error loading schedules.</Text>
//         <Button onPress={() => refetch()}>
//           <Button.Label>Retry</Button.Label>
//         </Button>
//       </View>
//     );
//   }

//   // --- Footer Component for Offline/Loading More ---
//   const renderFooter = () => {
//     if (isFetchingNextPage) {
//       return <Spinner style={{ padding: 20 }} />;
//     }

//     if (hasNextPage && !netInfo.isConnected) {
//       return (
//         <View style={styles.footerInfo}>
//           <Text style={styles.footerText}>
//             You are offline. Cannot load more schedules.
//           </Text>
//         </View>
//       );
//     }

//     return null;
//   };

//   console.log(classSchedules);

//   if (!classSchedules || classSchedules.length === 0) {
//     return (
//       <View style={styles.center}>
//         <Text>No schedules found.</Text>
//       </View>
//     );
//   }

//   return (
//     <FlashList
//       className="mx-auto w-full max-w-3xl"
//       keyExtractor={(item, index) =>
//         item?.id?.toString() || `schedule-${index}`
//       }
//       data={classSchedules}
//       renderItem={({ item }) => (
//         <Card style={styles.card}>
//           <Card.Body style={styles.cardBody}>
//             <View style={styles.header}>
//               <AppText style={styles.subjectName}>{item.subject_name}</AppText>
//               <AppText style={styles.teacherName}>
//                 {item.assign_teacher}
//               </AppText>
//             </View>

//             <Separator style={styles.separator} />

//             <View style={styles.detailsContainer}>
//               <View style={styles.detailRow}>
//                 <AppText style={styles.label}>Time:</AppText>
//                 <AppText style={styles.value}>
//                   {item.schedule_start_time} - {item.schedule_end_time}
//                 </AppText>
//               </View>

//               <View style={styles.detailRow}>
//                 <AppText style={styles.label}>Room:</AppText>
//                 <AppText style={styles.value}>{item.room}</AppText>
//               </View>
//             </View>

//             <View style={styles.daysContainer}>
//               {item.days_of_week.map((day) => (
//                 <Chip key={day} variant="soft" color="accent">
//                   <Chip.Label>{day}</Chip.Label>
//                 </Chip>
//               ))}
//             </View>
//           </Card.Body>
//         </Card>
//       )}
//       onEndReached={loadMore}
//       onEndReachedThreshold={0.5}
//       ListFooterComponent={renderFooter}
//       // --- Pull to Refresh ---
//       onRefresh={refetch}
//       refreshing={isRefetching}
//     />
//   );
// };

// const styles = StyleSheet.create({
//   center: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   card: {
//     marginBottom: 12,
//   },
//   cardBody: {
//     gap: 12,
//   },
//   header: {
//     gap: 4,
//   },
//   subjectName: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "#1a1a1a",
//   },
//   teacherName: {
//     fontSize: 14,
//     color: "#666",
//     fontWeight: "500",
//   },
//   separator: {
//     marginVertical: 4,
//   },
//   detailsContainer: {
//     gap: 8,
//   },
//   detailRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//   },
//   label: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#444",
//     minWidth: 50,
//   },
//   value: {
//     fontSize: 14,
//     color: "#666",
//     flex: 1,
//   },
//   daysContainer: {
//     flexDirection: "row",
//     flexWrap: "wrap",
//     gap: 6,
//     marginTop: 4,
//   },
//   dayChip: {
//     marginRight: 0,
//   },
//   item: {
//     padding: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: "#ccc",
//   },
//   footerInfo: {
//     padding: 20,
//     alignItems: "center",
//   },
//   footerText: {
//     color: "gray",
//     textAlign: "center",
//   },
// });

// export default ClassScheduleList;

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
        <Text>Error loading schedules.</Text>
        <Button onPress={() => refetch()}>
          <Button.Label>Retry</Button.Label>
        </Button>
      </View>
    );
  }

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
                <AppText style={styles.subjectName}>
                  {subject?.subjectName || "N/A"}
                </AppText>
                <AppText style={styles.teacherName}>
                  {teacher
                    ? `${teacher.firstName} ${teacher.lastName}`
                    : "No teacher assigned"}
                </AppText>
              </View>

              <Separator style={styles.separator} />

              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <AppText style={styles.label}>Time:</AppText>
                  <AppText style={styles.value}>
                    {schedule?.scheduleStartTime?.slice(0, 5) || "N/A"} -{" "}
                    {schedule?.scheduleEndTime?.slice(0, 5) || "N/A"}
                  </AppText>
                </View>

                <View style={styles.detailRow}>
                  <AppText style={styles.label}>Room:</AppText>
                  <AppText style={styles.value}>
                    {subject?.roomNumber || "N/A"}
                  </AppText>
                </View>
              </View>

              <View style={styles.daysContainer}>
                {schedule.daysOfWeek &&
                  schedule.daysOfWeek.split(",").map((day) => (
                    <Chip key={day} variant="soft" color="accent">
                      <Chip.Label>{day.trim()}</Chip.Label>
                    </Chip>
                  ))}
              </View>
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

const ClassScheduleSkeleton = () => {
  return (
    <View className="mx-auto w-full max-w-3xl gap-3 p-2.5">
      {Array(4)
        .fill(0)
        .map((_, index) => (
          <Card key={index} style={styles.card}>
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
