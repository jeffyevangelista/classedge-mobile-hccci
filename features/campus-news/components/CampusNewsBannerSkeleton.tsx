import { Skeleton } from "heroui-native";
import { View } from "react-native";

export function CampusNewsBannerSkeleton() {
  return (
    <View>
      <Skeleton className="rounded-2xl w-full" style={{ height: 220 }} />
      <View className="flex-row justify-center items-center gap-1.5 mt-3">
        <View className="w-1.5 h-1.5 rounded-full bg-muted" />
        <View className="w-1.5 h-1.5 rounded-full bg-muted" />
        <View className="w-1.5 h-1.5 rounded-full bg-muted" />
      </View>
    </View>
  );
}
