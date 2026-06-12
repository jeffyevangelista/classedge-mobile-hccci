import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  useColorScheme,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import WebView from "react-native-webview";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

// PDF attachments use a red identity, distinct from image (teal) and video
// (purple) so file types are recognizable at a glance.
const PDF_ICON_COLOR = "#ef4444";

interface Props {
  uri: string;
  fileName: string;
}

export const AttachmentPdfCard = ({ uri, fileName }: Props) => {
  const [fullscreen, setFullscreen] = React.useState(false);
  const [opening, setOpening] = React.useState(false);
  const mutedColor = useThemeColor("muted");

  const handlePress = async () => {
    if (opening) return;
    if (Platform.OS === "android") {
      setOpening(true);
      try {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync(
          "android.intent.action.VIEW",
          {
            data: contentUri,
            type: "application/pdf",
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          },
        );
      } catch {
        setFullscreen(true);
      } finally {
        setOpening(false);
      }
      return;
    }
    setFullscreen(true);
  };

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={opening}
        accessibilityRole="button"
        accessibilityLabel={`Open PDF ${fileName}`}
        accessibilityState={{ disabled: opening, busy: opening }}
        android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
        className="flex-row items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3 active:opacity-70"
      >
        <View className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 items-center justify-center shrink-0">
          {opening ? (
            <ActivityIndicator color={PDF_ICON_COLOR} />
          ) : (
            <Icon name="FilePdfIcon" size={20} color={PDF_ICON_COLOR} />
          )}
        </View>
        <View className="flex-1">
          <AppText
            numberOfLines={1}
            ellipsizeMode="middle"
            className="text-sm"
          >
            {fileName}
          </AppText>
          <AppText className="text-xs text-muted mt-0.5">Tap to view</AppText>
        </View>
        <Icon name="ArrowSquareOutIcon" size={16} color={mutedColor} />
      </Pressable>

      <Modal
        visible={fullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreen(false)}
      >
        {fullscreen ? (
          <FullscreenPdfView
            uri={uri}
            onClose={() => setFullscreen(false)}
          />
        ) : null}
      </Modal>
    </>
  );
};

const FullscreenPdfView = ({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const bg = isDark ? "#1a1a1a" : "#f5f5f5";
  const [loading, setLoading] = React.useState(true);

  return (
    <>
      <StatusBar
        hidden={false}
        barStyle={isDark ? "light-content" : "dark-content"}
      />
      <View style={{ flex: 1, backgroundColor: bg }}>
        <WebView
          source={{ uri }}
          style={{ flex: 1 }}
          originWhitelist={["*"]}
          javaScriptEnabled
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
        />
        {/* Spinner overlays the WebView until the PDF finishes loading.
            `onLoadEnd` fires for both success and failure so the spinner
            doesn't get stranded on a broken page. */}
        {loading ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator
              size="large"
              color={isDark ? "#ffffff" : "#1e293b"}
            />
          </View>
        ) : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
          hitSlop={8}
          style={{
            position: "absolute",
            top: 60,
            right: 16,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.55)",
            borderRadius: 22,
            zIndex: 100001,
          }}
          className="active:opacity-70"
        >
          <Icon name="XIcon" size={24} color="#ffffff" />
        </Pressable>
      </View>
    </>
  );
};
