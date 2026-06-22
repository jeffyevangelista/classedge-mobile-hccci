import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon } from "@/components/Icon";
import { SectionHeader } from "@/components/SectionHeader";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { getApiErrorMessage } from "@/lib/api-error";
import { useFacebookPosts } from "../campus-news.hooks";
import { CampusNewsBanner } from "./CampusNewsBanner";
import { CampusNewsBannerSkeleton } from "./CampusNewsBannerSkeleton";

export default function CampusNewsSection() {
  const { data, isLoading, isError, error, refetch } = useFacebookPosts();
  const posts = data?.posts ?? [];

  const status = useSectionStatus({
    data: posts,
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError) {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader title="Campus News" iconName="NewspaperIcon" />
        <ErrorComponent
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  if (status.phase === "loading") {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader title="Campus News" iconName="NewspaperIcon" />
        <CampusNewsBannerSkeleton />
      </View>
    );
  }

  if (status.phase === "offline-empty") {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader title="Campus News" iconName="NewspaperIcon" />
        <OfflineEmpty section="campus-news" />
      </View>
    );
  }

  if (status.phase === "empty") {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader title="Campus News" iconName="NewspaperIcon" />
        <View className="items-center justify-center py-8 gap-2 rounded-2xl border border-border bg-surface-secondary">
          <Icon name="NewspaperIcon" size={28} className="text-muted" />
          <AppText className="text-sm text-muted">No campus news yet</AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
      <SectionHeader title="Campus News" iconName="NewspaperIcon" />
      <CampusNewsBanner posts={posts} />
    </View>
  );
}
