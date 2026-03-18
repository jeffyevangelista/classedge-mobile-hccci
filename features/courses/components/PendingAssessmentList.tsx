import { View, StyleSheet, ScrollView } from "react-native";
import React, { memo } from "react";
import { usePendingAssessments } from "../courses.hooks";
import { AppText } from "@/components/AppText";
import { Card, Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import { Assessment } from "../courses.types";

const PendingAssessmentList = ({
  subjectId,
  horizontal,
}: {
  subjectId: string | null;
  horizontal: boolean;
}) => {
  const { data, isError, error, isLoading } = usePendingAssessments(subjectId);

  if (isLoading) {
    return (
      <ScrollView
        horizontal={horizontal}
        showsHorizontalScrollIndicator={false}
      >
        {Array(5)
          .fill(0)
          .map((_, index) => (
            <LoadingSkeleton key={index} />
          ))}
      </ScrollView>
    );
  }
  if (isError) return <AppText>{error.message}</AppText>;

  if (!data || data.length === 0)
    return (
      <View className=" w-full items-center justify-center max-w-2xl mx-auto">
        <View className="p-2 bg-emerald-100 rounded-full">
          <Icon name="ConfettiIcon" size={32} className="text-emerald-500" />
        </View>
        <AppText className="text-center">You caught up!</AppText>
        <AppText className="text-center text-xs text-gray-500">
          You have no pending assessments
        </AppText>
      </View>
    );

  return (
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
  );
};

export default PendingAssessmentList;

const AssessmentItem = memo(({ item }: { item: Assessment }) => (
  <Card className=" w-72 md:w-80 lg:w-96 mr-3 shadow-none">
    <Card.Body className="flex flex-row items-center gap-2.5">
      <View className="p-2 bg-emerald-100 rounded-full">
        <Icon name="BookOpenIcon" size={24} className="text-emerald-500" />
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

const LoadingSkeleton = () => (
  <Skeleton className="h-19 rounded-3xl w-72 md:w-80 lg:w-96 mr-3 shadow-none"></Skeleton>
);

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
