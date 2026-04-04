import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";
import { useCamera } from "../useCamera";
import type { CapturedPhoto } from "../useCamera";

type CameraViewScreenProps = {
  onCapture?: (photo: CapturedPhoto) => void;
};

const CameraViewScreen = ({ onCapture }: CameraViewScreenProps) => {
  const router = useRouter();
  const {
    cameraRef,
    permission,
    facing,
    flash,
    photo,
    ensurePermission,
    takePicture,
    toggleFacing,
    toggleFlash,
    resetPhoto,
  } = useCamera();

  useEffect(() => {
    ensurePermission();
  }, []);

  const handleCapture = useCallback(async () => {
    const result = await takePicture();
    if (result && onCapture) {
      onCapture(result);
    }
  }, [takePicture, onCapture]);

  const handleConfirm = useCallback(() => {
    if (photo && onCapture) {
      onCapture(photo);
    }
    router.back();
  }, [photo, onCapture, router]);

  const handleRetake = useCallback(() => {
    resetPhoto();
  }, [resetPhoto]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Icon name="CameraSlashIcon" size={48} color="#999" />
        <AppText className="text-base text-gray-500 mt-4 text-center px-8">
          Camera permission is required to take photos.
        </AppText>
        <Pressable style={styles.permissionButton} onPress={ensurePermission}>
          <AppText className="text-white text-sm" weight="semibold">
            Grant Permission
          </AppText>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (photo) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: photo.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <SafeAreaView style={styles.overlay}>
          <View style={styles.topBar}>
            <Pressable style={styles.iconButton} onPress={handleRetake}>
              <Icon name="XIcon" size={24} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.bottomBar}>
            <Pressable style={styles.actionButton} onPress={handleRetake}>
              <Icon name="ArrowCounterClockwiseIcon" size={24} color="#fff" />
              <AppText className="text-white text-xs mt-1">Retake</AppText>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={handleConfirm}>
              <Icon name="CheckIcon" size={24} color="#fff" />
              <AppText className="text-white text-xs mt-1">Use Photo</AppText>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
      />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Icon name="XIcon" size={24} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={toggleFlash}>
            <Icon
              name={flash === "on" ? "LightningIcon" : "LightningSlashIcon"}
              size={24}
              color="#fff"
            />
          </Pressable>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.bottomSpacer} />

          <Pressable style={styles.captureButton} onPress={handleCapture}>
            <View style={styles.captureInner} />
          </Pressable>

          <View style={styles.bottomSpacer}>
            <Pressable style={styles.iconButton} onPress={toggleFacing}>
              <Icon name="CameraRotateIcon" size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  bottomSpacer: {
    flex: 1,
    alignItems: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  actionButton: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: "#2285D5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
});

export default CameraViewScreen;
