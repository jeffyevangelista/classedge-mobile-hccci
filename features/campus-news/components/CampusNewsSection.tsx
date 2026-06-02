import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { getApiErrorMessage } from "@/lib/api-error";
import { useFacebookPosts } from "../campus-news.hooks";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
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
        <SectionHeader />
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
        <SectionHeader />
        <CampusNewsBannerSkeleton />
      </View>
    );
  }

  if (status.phase === "offline-empty") {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader />
        <OfflineEmpty section="campus-news" />
      </View>
    );
  }

  // phase "empty" → hide section entirely (current behavior preserved)
  if (status.phase === "empty") return null;

  return (
    <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
      <SectionHeader />
      <CampusNewsBanner posts={posts} />
    </View>
  );
}

const SectionHeader = () => (
  <AppText weight="semibold" className="text-lg mb-3">
    Campus News
  </AppText>
);
