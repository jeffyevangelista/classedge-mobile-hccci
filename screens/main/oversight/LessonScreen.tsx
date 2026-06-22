import { useLocalSearchParams } from "expo-router";
import { Skeleton } from "heroui-native";
import React from "react";
import {
  Modal,
  Pressable,
  StatusBar,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { AppText } from "@/components/AppText";
import { CollapsibleDescription } from "@/components/CollapsibleDescription";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import { LinkCard } from "@/components/LinkCard";
import NoDataFallback from "@/components/NoDataFallback";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import Screen from "@/components/screen";
import { RemoteAttachmentFile } from "@/features/attachments/components/RemoteAttachmentFile";
import { useLesson } from "@/features/oversight/oversight.hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/utils/formatDate";

const LessonScreen = () => {
  const { lessonId } = useLocalSearchParams();
  const { isLoading, isError, error, data, isRefetching, isFetching, refetch } =
    useLesson(lessonId as string);

  // Render the skeleton any time a fetch is in flight and we have
  // nothing to show — see features/classroom/components/LessonList for
  // the full rationale.
  if ((isLoading || isFetching) && !data) return <LessonScreenSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  if (!data)
    return (
      <NoDataFallback
        title="Lesson not found"
        description="The lesson you're looking for doesn't exist"
        onRefetch={refetch}
      />
    );

  const fileName = data.lessonFile
    ? (data.lessonFile.split("/").pop() ?? data.lessonName)
    : data.lessonName;
  const isEmbedded = data.lessonType === "embedded_content";

  // Only offer to collapse the description when there's something below
  // it the user might want to reach without scrolling. Descriptions that
  // ARE the lesson's content (no file/link/embed) stay fully expanded.
  const canCollapseDescription = !!(data.lessonFile || data.lessonUrl);

  return (
    <Screen>
      <ScreenScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View className="gap-6 w-full max-w-3xl mx-auto p-4">
          <View>
            <AppText className="text-sm text-muted">
              Posted {formatDate(data.startDate)}
            </AppText>
            <AppText
              weight="semibold"
              numberOfLines={2}
              ellipsizeMode="tail"
              className="text-xl text-foreground mt-1"
            >
              {data.lessonName}
            </AppText>
          </View>

          {data.lessonDescription && (
            <View>
              <SectionLabel>Description</SectionLabel>
              <CollapsibleDescription
                text={data.lessonDescription}
                canCollapse={canCollapseDescription}
              />
            </View>
          )}

          {data.lessonFile && (
            <View>
              <SectionLabel>Attached File</SectionLabel>
              <RemoteAttachmentFile url={data.lessonFile} fileName={fileName} />
            </View>
          )}

          {data.lessonUrl && isEmbedded && (
            <View>
              <SectionLabel>Embedded Content</SectionLabel>
              <IFrameViewer url={data.lessonUrl} />
            </View>
          )}

          {data.lessonUrl && !isEmbedded && (
            <View>
              <SectionLabel>Link</SectionLabel>
              <LinkCard url={data.lessonUrl} />
            </View>
          )}
        </View>
      </ScreenScrollView>
    </Screen>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <AppText
    weight="semibold"
    className="text-xs uppercase tracking-wider text-muted mb-2"
  >
    {children}
  </AppText>
);

const IFrameViewer = ({ url }: { url: string }) => {
  const { width } = useWindowDimensions();
  const [fullscreen, setFullscreen] = React.useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const closeBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const closeColor = isDark ? "#e5e5e5" : "#333";

  // Wrap the URL in a responsive HTML shell that forces the iframe to
  // fill the viewport and disables internal scrolling. Mirrors the
  // MaterialDetailsScreen embed handling — lessons store the embed
  // target as a bare URL, so we construct the iframe ourselves rather
  // than expecting raw iframe HTML.
  const page = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe {
      width: 100% !important;
      height: 100% !important;
      border: none !important;
      display: block;
    }
  </style>
</head>
<body><iframe src="${url}" allow="autoplay; encrypted-media" allowfullscreen></iframe></body>
</html>`;

  // 16:9 aspect ratio to fit standard embeds (YouTube, Drive, Vimeo,
  // Sway, etc.)
  const viewerHeight = Math.round((width - 32) * (9 / 16));

  const webview = (flex: boolean) => (
    <WebView
      source={{ html: page }}
      style={flex ? { flex: 1 } : { width: "100%", height: viewerHeight }}
      originWhitelist={["*"]}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      scrollEnabled={false}
    />
  );

  return (
    <>
      <View
        style={{
          height: viewerHeight,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        {webview(false)}
        <Pressable
          onPress={() => setFullscreen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open fullscreen"
          android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
          hitSlop={8}
          className="active:opacity-70"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            backgroundColor: "rgba(0,0,0,0.45)",
            borderRadius: 8,
            padding: 6,
          }}
        >
          <Icon name="ArrowsOutIcon" size={18} color="#fff" />
        </Pressable>
      </View>

      <Modal
        visible={fullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreen(false)}
      >
        <StatusBar
          hidden={false}
          barStyle={isDark ? "light-content" : "dark-content"}
        />
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: "#000",
            }}
          >
            <Pressable
              onPress={() => setFullscreen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close fullscreen"
              android_ripple={{
                color: "rgba(255,255,255,0.15)",
                borderless: true,
              }}
              hitSlop={8}
              className="active:opacity-70"
              style={{
                backgroundColor: closeBg,
                borderRadius: 8,
                padding: 6,
              }}
            >
              <Icon name="XIcon" size={20} color={closeColor} />
            </Pressable>
          </View>
          {webview(true)}
        </SafeAreaView>
      </Modal>
    </>
  );
};

const LessonScreenSkeleton = () => (
  <Screen>
    <View className="gap-6 w-full max-w-3xl mx-auto p-4">
      <View>
        <Skeleton className="h-3 w-40 rounded-full" />
        <Skeleton className="h-6 w-3/4 rounded-full mt-2" />
      </View>
      <View className="gap-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-2/3 rounded-full" />
      </View>
      <View className="gap-2">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </View>
    </View>
  </Screen>
);

export default LessonScreen;
