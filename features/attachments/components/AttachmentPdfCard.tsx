import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import WebView from "react-native-webview";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

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
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        disabled={opening}
        accessibilityRole="button"
        accessibilityLabel={`Open PDF ${fileName}`}
        accessibilityState={{ disabled: opening, busy: opening }}
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
            numberOfLines={1}
            ellipsizeMode="middle"
            className="text-sm"
          >
            {fileName}
          </AppText>
          <AppText className="text-xs text-muted mt-0.5">Tap to view</AppText>
        </View>
        <Icon name="ArrowSquareOutIcon" size={18} color={mutedColor} />
      </TouchableOpacity>

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
        />
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
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
        >
          <Icon name="XIcon" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </>
  );
};
