import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as WebBrowser from "expo-web-browser";
import { useCourseMaterial } from "@/features/courses/courses.hooks";
import { useLocalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { Skeleton } from "heroui-native";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAttachment } from "@/features/attachments/hooks/useAttachment";
import { useImage } from "@/providers/ImageProvider";
import React from "react";
import { VideoView, useVideoPlayer } from "expo-video";
import WebView from "react-native-webview";
import { Icon } from "@/components/Icon";

type FileType = "image" | "video" | "pdf" | "other";

const IMAGE_EXTS = [
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif",
  "bmp", "tiff", "tif", "avif", "jfif", "svg",
];
const VIDEO_EXTS = [
  "mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp", "3g2", "wmv",
  "flv", "f4v", "ts", "mts", "m2ts", "mpg", "mpeg", "mp2", "mpe",
  "ogv", "ogg", "rm", "rmvb", "asf", "divx", "vob", "dv", "mxf",
];

function getFileType(path: string): FileType {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "other";
}

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
    <Screen className="bg-white dark:bg-neutral-900">
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
              <MaterialFile file={data.file} fileName={data.fileName} />
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

const MaterialFile = ({
  file,
  fileName,
}: {
  file: string;
  fileName: string;
}) => {
  const { uri, state, retry } = useAttachment(file);
  const type = getFileType(file);

  if (state === "unknown" || state === "queued" || state === "downloading") {
    return (
      <View className="w-full h-20 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex-row items-center gap-3 px-4">
        <ActivityIndicator />
        <AppText className="text-sm text-neutral-500 dark:text-neutral-400">
          {state === "downloading" ? "Downloading..." : "Preparing file..."}
        </AppText>
      </View>
    );
  }

  if (state === "failed") {
    return (
      <View className="w-full h-20 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex-row items-center gap-3 px-4">
        <Icon name="WarningCircleIcon" size={24} color="#ef4444" />
        <AppText className="flex-1 text-sm text-neutral-500 dark:text-neutral-400">
          Failed to load file
        </AppText>
        <TouchableOpacity
          onPress={retry}
          className="flex-row items-center gap-1 bg-red-500 px-3 py-1.5 rounded-lg"
        >
          <Icon name="ArrowsClockwiseIcon" size={13} color="#fff" />
          <AppText className="text-white text-xs">Retry</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (!uri) return null;

  if (type === "image") return <ImageCard uri={uri} fileName={fileName} />;
  if (type === "video") return <VideoPlayer uri={uri} fileName={fileName} />;
  if (type === "pdf") return <PDFViewer uri={uri} />;

  return (
    <View className="w-full h-20 bg-neutral-100 dark:bg-neutral-800 rounded-xl items-center justify-center">
      <AppText className="text-sm text-neutral-500 dark:text-neutral-400">
        Cannot preview this file type
      </AppText>
    </View>
  );
};

const ImageCard = ({
  uri,
  fileName,
}: {
  uri: string;
  fileName: string;
}) => {
  const { showImage } = useImage();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => showImage(uri)}
      className="flex-row items-center gap-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-3"
    >
      <View className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/50 items-center justify-center shrink-0">
        <Icon name="ImageIcon" size={20} color="#0d9488" />
      </View>
      <View className="flex-1">
        <AppText
          numberOfLines={1}
          ellipsizeMode="tail"
          className="text-neutral-900 dark:text-neutral-100 text-sm"
        >
          {fileName}
        </AppText>
        <AppText className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
          Tap to view
        </AppText>
      </View>
      <Icon name="ArrowsOutIcon" size={16} color="#94a3b8" />
    </TouchableOpacity>
  );
};

const VideoPlayer = ({
  uri,
  fileName,
}: {
  uri: string;
  fileName: string;
}) => {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
  });

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2 px-1">
        <View className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/50 items-center justify-center">
          <Icon name="FilmSlateIcon" size={14} color="#9333ea" />
        </View>
        <AppText
          numberOfLines={1}
          ellipsizeMode="tail"
          className="flex-1 text-sm text-neutral-700 dark:text-neutral-300"
        >
          {fileName}
        </AppText>
      </View>
      <View
        style={{ width: "100%", height: 240, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}
      >
        <VideoView
          player={player}
          style={{ width: "100%", height: 240 }}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
      </View>
    </View>
  );
};

const PDFViewer = ({ uri }: { uri: string }) => {
  if (Platform.OS === "android") {
    return <AndroidPDFCard uri={uri} />;
  }
  return <IOSPDFViewer uri={uri} />;
};

const IOSPDFViewer = ({ uri }: { uri: string }) => {
  const { height } = useWindowDimensions();
  const [fullscreen, setFullscreen] = React.useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const bg = isDark ? "#1a1a1a" : "#f5f5f5";
  const closeBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const closeColor = isDark ? "#e5e5e5" : "#333";

  const webview = (flex: boolean) => (
    <WebView
      source={{ uri }}
      style={flex ? { flex: 1 } : { width: "100%", height: Math.round(height * 0.65) }}
      originWhitelist={["*"]}
      javaScriptEnabled
    />
  );

  return (
    <>
      <View
        style={{
          height: Math.round(height * 0.65),
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: bg,
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
        <StatusBar hidden={false} barStyle={isDark ? "light-content" : "dark-content"} />
        <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: bg }}>
            <TouchableOpacity
              onPress={() => setFullscreen(false)}
              style={{ backgroundColor: closeBg, borderRadius: 8, padding: 6 }}
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

const AndroidPDFCard = ({ uri }: { uri: string }) => {
  const [opening, setOpening] = React.useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: "application/pdf",
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    } catch {
      // no-op
    } finally {
      setOpening(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={open}
      disabled={opening}
      className="flex-row items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl px-4 py-4"
    >
      <View className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/50 items-center justify-center shrink-0">
        {opening ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <Icon name="FilePdfIcon" size={24} color="#ef4444" />
        )}
      </View>
      <View className="flex-1">
        <AppText
          weight="semibold"
          className="text-neutral-900 dark:text-neutral-100 text-sm"
        >
          PDF Document
        </AppText>
        <AppText className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Tap to open in PDF viewer
        </AppText>
      </View>
      <Icon name="ArrowSquareOutIcon" size={18} color="#94a3b8" />
    </TouchableOpacity>
  );
};

const IFrameViewer = ({ html }: { html: string }) => {
  const { width } = useWindowDimensions();

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

  return (
    <View
      style={{
        height: viewerHeight,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <WebView
        source={{ html: page }}
        style={{ flex: 1 }}
        originWhitelist={["*"]}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
      />
    </View>
  );
};

const LinkCard = ({ url }: { url: string }) => {
  const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => WebBrowser.openBrowserAsync(url)}
      className="flex-row items-center gap-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-3"
    >
      <View className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 items-center justify-center shrink-0">
        <Icon name="LinkIcon" size={20} color="#3b82f6" />
      </View>
      <AppText
        numberOfLines={2}
        className="flex-1 text-blue-600 dark:text-blue-400 text-sm"
      >
        {display}
      </AppText>
      <Icon name="ArrowSquareOutIcon" size={16} color="#94a3b8" />
    </TouchableOpacity>
  );
};

const MaterialDetailsSkeleton = () => (
  <Screen className="bg-white dark:bg-neutral-900">
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
