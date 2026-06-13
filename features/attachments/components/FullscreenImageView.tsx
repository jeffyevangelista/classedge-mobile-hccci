import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { Zoomable } from "@likashefqet/react-native-image-zoom";
import { Icon } from "@/components/Icon";

interface Props {
  uri: string;
  onClose: () => void;
}

/**
 * Local fullscreen image viewer for already-known URIs (the picker's
 * `file://` path, downloaded local files, etc). Uses React Native's
 * `Image` rather than `expo-image` because the latter has been observed
 * to silently fail to render some `file://` URIs returned by
 * `expo-image-picker` on Android.
 */
export const FullscreenImageView = ({ uri, onClose }: Props) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [loaded, setLoaded] = useState(false);

  const { width, height } = Dimensions.get("window");

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        barStyle={isDark ? "light-content" : "light-content"}
      />
      <Zoomable
        isDoubleTapEnabled
        isSingleTapEnabled
        onSingleTap={onClose}
      >
        <Image
          source={{ uri }}
          style={{ width, height }}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </Zoomable>
      {!loaded ? (
        <View pointerEvents="none" style={styles.spinner}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : null}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
        hitSlop={8}
        style={styles.closeButton}
        className="active:opacity-70"
      >
        <Icon name="XIcon" size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
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
  },
});
