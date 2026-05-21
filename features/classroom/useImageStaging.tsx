import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useCamera } from "@/features/camera/useCamera";
import { useImagePicker } from "@/features/classroom/useImagePicker";
import { saveAttachment } from "@/features/classroom/ classroom.service";
import { ImageSourceSheet } from "@/features/classroom/components/ImageSourceSheet";

type Args = {
  /**
   * Called once the user has picked or captured an image and it has been
   * copied to the app's persistent attachments dir. Receives the studentId
   * that originally requested the attach and the persistent file URI.
   * The caller is responsible for updating its own image state.
   */
  onAttach: (studentId: number, persistentUri: string) => void;
};

/**
 * Single-instance image attach orchestration. Owns the source sheet, camera
 * modal, library picker, and camera hook so that consumers (e.g. a list of
 * rows) don't end up mounting one of each per row.
 */
export function useImageStaging({ onAttach }: Args) {
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

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
  const { pick: pickFromLibrary } = useImagePicker();

  const persistAndAttach = useCallback(
    async (uri: string, studentId: number) => {
      try {
        // Copy the picker/camera cache URI into our persistent attachments dir.
        // Cache files can be evicted before the PowerSync upload window — the
        // persistent URI is what the caller hands to PowerSync on save.
        const persistent = await saveAttachment(uri);
        onAttach(studentId, persistent);
      } catch (err) {
        console.error("[useImageStaging] saveAttachment failed:", err);
        Alert.alert("Failed to save image", "Please try again.");
      }
    },
    [onAttach],
  );

  const requestAttach = useCallback((studentId: number) => {
    setActiveStudentId(studentId);
    setShowSheet(true);
  }, []);

  const handlePickLibrary = useCallback(async () => {
    if (activeStudentId == null) return;
    const picked = await pickFromLibrary();
    if (picked) {
      await persistAndAttach(picked.uri, activeStudentId);
    }
  }, [activeStudentId, pickFromLibrary, persistAndAttach]);

  const handlePickCamera = useCallback(async () => {
    const granted = await ensureCameraPermission();
    if (granted) setShowCamera(true);
  }, [ensureCameraPermission]);

  const handleCapture = useCallback(async () => {
    if (activeStudentId == null) return;
    const photo = await takePicture();
    if (photo) {
      resetPhoto();
      setShowCamera(false);
      await persistAndAttach(photo.uri, activeStudentId);
    }
  }, [activeStudentId, takePicture, resetPhoto, persistAndAttach]);

  const portal = (
    <>
      <ImageSourceSheet
        isOpen={showSheet}
        onOpenChange={setShowSheet}
        onPickCamera={handlePickCamera}
        onPickLibrary={handlePickLibrary}
      />
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
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
                onPress={() => setShowCamera(false)}
              >
                <Icon name="XIcon" size={24} color="#fff" />
              </Pressable>
              <Pressable style={styles.cameraIconButton} onPress={toggleFlash}>
                <Icon
                  name={flash === "on" ? "LightningIcon" : "LightningSlashIcon"}
                  size={24}
                  color="#fff"
                />
              </Pressable>
            </View>

            <View style={styles.cameraBottomBar}>
              <View style={styles.cameraSpacer} />
              <Pressable style={styles.captureButton} onPress={handleCapture}>
                <View style={styles.captureInner} />
              </Pressable>
              <View style={styles.cameraSpacer}>
                <Pressable
                  style={styles.cameraIconButton}
                  onPress={toggleFacing}
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

  return { requestAttach, portal };
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
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
  cameraSpacer: {
    flex: 1,
    alignItems: "center",
  },
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
