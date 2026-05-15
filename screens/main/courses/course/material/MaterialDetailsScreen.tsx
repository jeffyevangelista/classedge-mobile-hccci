import {
  Modal,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useCourseMaterial } from "@/features/courses/courses.hooks";
import { useLocalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { Skeleton, useThemeColor } from "heroui-native";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { AttachmentFile } from "@/features/attachments/components/AttachmentFile";
import React from "react";
import WebView from "react-native-webview";
import { Icon } from "@/components/Icon";

const MaterialDetailsScreen = () => {
  const { materialId } = useLocalSearchParams();
  const { data, isLoading, isError, error } = useCourseMaterial(
    materialId as string,
  );

  if (isLoading) return <MaterialDetailsSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;
  if (!data)
    return (
      <NoDataFallback
        title="Material not found"
        description="The material you're looking for doesn't exist"
      />
    );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <Screen>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-6 w-full max-w-3xl mx-auto p-4">
          <View>
            <AppText className="text-sm text-neutral-500 dark:text-neutral-400">
              {formatDate(data.startDate)} – {formatDate(data.endDate)}
            </AppText>
            <AppText
              weight="semibold"
              className="text-xl text-neutral-900 dark:text-neutral-100 mt-1"
            >
              {data.fileName}
            </AppText>
          </View>

          {data.description && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-1"
              >
                Description
              </AppText>
              <AppText className="text-neutral-500 dark:text-neutral-400 text-justify leading-relaxed">
                {data.description}
              </AppText>
            </View>
          )}

          {data.file && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-2"
              >
                Attached File
              </AppText>
              <AttachmentFile file={data.file} fileName={data.fileName} />
            </View>
          )}

          {data.iframeCode && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-2"
              >
                Embedded Content
              </AppText>
              <IFrameViewer html={data.iframeCode} />
            </View>
          )}

          {data.url && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-2"
              >
                Link
              </AppText>
              <LinkCard url={data.url} />
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
};

const IFrameViewer = ({ html }: { html: string }) => {
  const { width } = useWindowDimensions();
  const [fullscreen, setFullscreen] = React.useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const closeBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const closeColor = isDark ? "#e5e5e5" : "#333";

  // Wrap the raw iframe snippet in a responsive HTML shell that forces
  // the iframe to fill the viewport and disables internal scrolling.
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
<body>${html}</body>
</html>`;

  // 16:9 aspect ratio to fit standard embeds (YouTube, Drive, Vimeo, etc.)
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
        <TouchableOpacity
          onPress={() => setFullscreen(true)}
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
        </TouchableOpacity>
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
            <TouchableOpacity
              onPress={() => setFullscreen(false)}
              style={{
                backgroundColor: closeBg,
                borderRadius: 8,
                padding: 6,
              }}
            >
              <Icon name="XIcon" size={20} color={closeColor} />
            </TouchableOpacity>
          </View>
          {webview(true)}
        </SafeAreaView>
      </Modal>
    </>
  );
};

const LinkCard = ({ url }: { url: string }) => {
  const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const themeColorAccent = useThemeColor("accent");

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => WebBrowser.openBrowserAsync(url)}
      className="flex-row items-center gap-3 bg-default rounded-xl px-4 py-3"
    >
      <View className="w-10 h-10 rounded-lg bg-accent-soft items-center justify-center shrink-0">
        <Icon name="LinkIcon" size={20} color={themeColorAccent} />
      </View>
      <AppText
        numberOfLines={2}
        className="flex-1 text-accent text-sm"
      >
        {display}
      </AppText>
      <Icon name="ArrowSquareOutIcon" size={16} color="#94a3b8" />
    </TouchableOpacity>
  );
};

const MaterialDetailsSkeleton = () => (
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

export default MaterialDetailsScreen;
