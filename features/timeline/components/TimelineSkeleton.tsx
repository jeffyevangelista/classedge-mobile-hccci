import { View } from "react-native";
import { Card, Skeleton } from "heroui-native";

export const TimelineSkeleton = () => {
  return (
    <View className="mt-5">
      <View className="w-full max-w-3xl mx-auto px-2 mb-3 flex-row gap-2">
        <Skeleton className="h-7 w-12 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </View>
      <View className="w-full max-w-3xl mx-auto px-3 mb-1">
        <Skeleton className="h-3 w-20 rounded" />
      </View>
      {Array(5)
        .fill(0)
        .map((_, index) => (
          <View key={index} className="w-full max-w-3xl mx-auto">
            <Card className="rounded-xl flex-row items-center gap-3 shadow-none border border-border mb-1">
              <Skeleton className="w-10 h-10 rounded-full" />
              <View className="flex-1 gap-1.5">
                <Skeleton className="h-5 w-3/4 rounded" />
                <View className="flex-row items-center gap-1.5">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </View>
              </View>
            </Card>
          </View>
        ))}
    </View>
  );
};
