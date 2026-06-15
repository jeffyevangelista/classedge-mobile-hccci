import { useCallback, useState } from "react";
import { Alert, Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "heroui-native";
import { Icon } from "@/components/Icon";
import { useCamera } from "@/features/camera/useCamera";
import { saveAttachment } from "@/features/classroom/ classroom.service";
import { ProfilePhotoActionSheet } from "@/features/profile/components/ProfilePhotoActionSheet";
import { useUpdateStudentPhoto } from "@/features/profile/useUpdateStudentPhoto";

type EditTarget = {
  profileId: number;
  currentPhoto?: string | null;
};

const MANIPULATE_MAX_WIDTH = 1024;
const MANIPULATE_QUALITY = 0.8;

export function useProfilePhotoActionSheet() {
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { toast } = useToast();

  const {
    cameraRef,
    facing,
    flash,
    ensurePermission: ensureCameraPermission,
    takePicture,
    toggleFacing,
    toggleFlash,
    resetPhoto,
  } = useCamera();
  const updateStudentPhoto = useUpdateStudentPhoto();

  const requestEdit = useCallback((next: EditTarget) => {
    setTarget(next);
    setShowSheet(true);
  }, []);

  const persistAndUpdate = useCallback(
    async (sourceUri: string) => {
      if (!target) return;
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          sourceUri,
          [{ resize: { width: MANIPULATE_MAX_WIDTH } }],
          {
            compress: MANIPULATE_QUALITY,
            format: ImageManipulator.SaveFormat.JPEG,
          },
        );
        const persistent = await saveAttachment(manipulated.uri);
        await updateStudentPhoto(target.profileId, persistent);
      } catch (err) {
        console.error("[useProfilePhotoActionSheet] persist failed:", err);
        toast.show({
          label: "Couldn't save that photo",
          description: "Please try again.",
          variant: "danger",
        });
      }
    },
    [target, toast, updateStudentPhoto],
  );

  const handlePickLibrary = useCallback(async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = result.granted;
      if (!granted && !result.canAskAgain) {
        Alert.alert(
          "Photo Library Permission Required",
          "Enable photo library access in Settings to choose a profile photo.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      if (!granted) return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await persistAndUpdate(result.assets[0].uri);
  }, [persistAndUpdate]);

  const handlePickCamera = useCallback(async () => {
    const granted = await ensureCameraPermission();
    if (!granted) {
      toast.show({
        label: "Camera permission denied",
        description: "Enable camera access in Settings to take a photo.",
        variant: "danger",
      });
      return;
    }
    setShowCamera(true);
  }, [ensureCameraPermission, toast]);

  const handleCapture = useCallback(async () => {
    const photo = await takePicture();
    if (!photo) return;
    setShowCamera(false);
    resetPhoto();
    await persistAndUpdate(photo.uri);
  }, [persistAndUpdate, resetPhoto, takePicture]);

  const handleCloseCamera = useCallback(() => {
    resetPhoto();
    setShowCamera(false);
  }, [resetPhoto]);

  const handleRemove = useCallback(() => {
    if (!target) return;
    Alert.alert(
      "Remove profile photo?",
      "Your initials will appear instead.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await updateStudentPhoto(target.profileId, "");
            } catch (err) {
              console.error("[useProfilePhotoActionSheet] remove failed:", err);
              toast.show({
                label: "Couldn't remove the photo",
                description: "Please try again.",
                variant: "danger",
              });
            }
          },
        },
      ],
    );
  }, [target, toast, updateStudentPhoto]);

  const portal = (
    <>
      <ProfilePhotoActionSheet
        isOpen={showSheet}
        onOpenChange={setShowSheet}
        onPickCamera={handlePickCamera}
        onPickLibrary={handlePickLibrary}
        onRemove={handleRemove}
        canRemove={!!target?.currentPhoto}
      />
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={handleCloseCamera}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
          />
          <SafeAreaView style={styles.cameraOverlay}>
            <View style={styles.cameraTopBar}>
              <Pressable
                style={styles.cameraIconButton}
                onPress={handleCloseCamera}
                accessibilityRole="button"
                accessibilityLabel="Close camera"
              >
                <Icon name="XIcon" size={24} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.cameraIconButton}
                onPress={toggleFlash}
                accessibilityRole="button"
                accessibilityLabel={flash === "on" ? "Turn flash off" : "Turn flash on"}
              >
                <Icon
                  name={flash === "on" ? "LightningIcon" : "LightningSlashIcon"}
                  size={24}
                  color="#fff"
                />
              </Pressable>
            </View>
            <View style={styles.cameraBottomBar}>
              <View style={styles.cameraSpacer} />
              <Pressable
                style={styles.captureButton}
                onPress={handleCapture}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
              >
                <View style={styles.captureInner} />
              </Pressable>
              <View style={styles.cameraSpacer}>
                <Pressable
                  style={styles.cameraIconButton}
                  onPress={toggleFacing}
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera"
                >
                  <Icon name="CameraRotateIcon" size={28} color="#fff" />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );

  return { requestEdit, portal };
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  cameraOverlay: { flex: 1, justifyContent: "space-between" },
  cameraTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cameraBottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  cameraSpacer: { flex: 1, alignItems: "center" },
  cameraIconButton: {
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
});
