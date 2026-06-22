import { CameraView } from "expo-camera";
import { useToast } from "heroui-native";
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import { type CapturedPhoto, useCamera } from "@/features/camera/useCamera";
import { saveAttachment } from "@/features/classroom/classroom.service";
import { ImageSourceSheet } from "@/features/classroom/components/ImageSourceSheet";
import { useImagePicker } from "@/features/classroom/useImagePicker";

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
 * modal (with capture → preview → retake flow), library picker, and camera
 * hook so that consumers (e.g. a list of rows) don't end up mounting one of
 * each per row.
 */
export function useImageStaging({ onAttach }: Args) {
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  // After takePicture(), hold the captured photo in `pendingPhoto` so the
  // teacher gets a Retake / Use checkpoint before we commit. Prevents
  // accidental blurry score-sheet captures from landing in the row.
  const [pendingPhoto, setPendingPhoto] = useState<CapturedPhoto | null>(null);
  const [gridOn, setGridOn] = useState(true);
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
        toast.show({
          label: "Couldn't save image",
          description: "Please try again.",
          variant: "danger",
        });
      }
    },
    [onAttach, toast],
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
    if (!granted) {
      toast.show({
        label: "Camera permission denied",
        description: "Enable camera access in Settings to capture.",
        variant: "danger",
      });
      return;
    }
    setShowCamera(true);
  }, [ensureCameraPermission, toast]);

  // Step 1 of capture: take the photo and surface it in the preview UI.
  // We don't persist yet — the teacher gets a chance to retake.
  const handleCapture = useCallback(async () => {
    const photo = await takePicture();
    if (photo) setPendingPhoto(photo);
  }, [takePicture]);

  // Step 2a — Retake: clear the pending photo and reset the camera so
  // the live preview comes back. Stay in the modal.
  const handleRetake = useCallback(() => {
    setPendingPhoto(null);
    resetPhoto();
  }, [resetPhoto]);

  // Step 2b — Use: persist and close the modal.
  const handleUse = useCallback(async () => {
    if (activeStudentId == null || !pendingPhoto) return;
    const studentId = activeStudentId;
    const uri = pendingPhoto.uri;
    setPendingPhoto(null);
    resetPhoto();
    setShowCamera(false);
    await persistAndAttach(uri, studentId);
  }, [activeStudentId, pendingPhoto, resetPhoto, persistAndAttach]);

  const handleCloseCamera = useCallback(() => {
    setPendingPhoto(null);
    resetPhoto();
    setShowCamera(false);
  }, [resetPhoto]);

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
        onRequestClose={handleCloseCamera}
      >
        <View style={styles.cameraContainer}>
          {pendingPhoto ? (
            // Preview state — captured photo + Retake / Use bar.
            <>
              <Image
                source={{ uri: pendingPhoto.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
              <SafeAreaView style={styles.cameraOverlay}>
                <View style={styles.cameraTopBar}>
                  <Pressable
                    style={styles.cameraIconButton}
                    onPress={handleCloseCamera}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel capture"
                  >
                    <Icon name="XIcon" size={24} color="#fff" />
                  </Pressable>
                </View>
                <View style={styles.previewBottomBar}>
                  <Pressable
                    style={styles.previewSecondary}
                    onPress={handleRetake}
                    accessibilityRole="button"
                    accessibilityLabel="Retake photo"
                  >
                    <Icon
                      name="ArrowCounterClockwiseIcon"
                      size={20}
                      color="#fff"
                    />
                    <AppText weight="semibold" className="text-sm text-white">
                      Retake
                    </AppText>
                  </Pressable>
                  <Pressable
                    style={styles.previewPrimary}
                    onPress={handleUse}
                    accessibilityRole="button"
                    accessibilityLabel="Use this photo"
                  >
                    <Icon name="CheckIcon" size={20} color="#0f172a" />
                    <AppText
                      weight="bold"
                      className="text-sm"
                      style={{ color: "#0f172a" }}
                    >
                      Use photo
                    </AppText>
                  </Pressable>
                </View>
              </SafeAreaView>
            </>
          ) : (
            // Live camera state — capture + controls.
            <>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                flash={flash}
              />
              {/* Rule-of-thirds grid — helps the teacher frame the
                  score sheet square to the camera. Toggled on by
                  default; can be hidden via the grid button. */}
              {gridOn ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <View style={styles.gridVLine1} />
                  <View style={styles.gridVLine2} />
                  <View style={styles.gridHLine1} />
                  <View style={styles.gridHLine2} />
                </View>
              ) : null}
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
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      style={[
                        styles.cameraIconButton,
                        gridOn ? styles.cameraIconButtonActive : null,
                      ]}
                      onPress={() => setGridOn((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        gridOn ? "Hide grid overlay" : "Show grid overlay"
                      }
                      accessibilityState={{ selected: gridOn }}
                    >
                      <Icon name="GridFourIcon" size={22} color="#fff" />
                    </Pressable>
                    <Pressable
                      style={styles.cameraIconButton}
                      onPress={toggleFlash}
                      accessibilityRole="button"
                      accessibilityLabel={
                        flash === "on" ? "Turn flash off" : "Turn flash on"
                      }
                    >
                      <Icon
                        name={
                          flash === "on"
                            ? "LightningIcon"
                            : "LightningSlashIcon"
                        }
                        size={24}
                        color="#fff"
                      />
                    </Pressable>
                  </View>
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
            </>
          )}
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
  cameraIconButtonActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
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
  gridVLine1: {
    position: "absolute",
    left: "33.33%",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  gridVLine2: {
    position: "absolute",
    left: "66.66%",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  gridHLine1: {
    position: "absolute",
    top: "33.33%",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  gridHLine2: {
    position: "absolute",
    top: "66.66%",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  previewBottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  previewSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  previewPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
});
