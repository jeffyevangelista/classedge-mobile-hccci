import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  useColorScheme,
  View,
} from "react-native";
import WebView from "react-native-webview";
import { Icon } from "@/components/Icon";

interface Props {
  uri: string;
  onClose: () => void;
}

export const FullscreenPdfView = ({ uri, onClose }: Props) => {
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
