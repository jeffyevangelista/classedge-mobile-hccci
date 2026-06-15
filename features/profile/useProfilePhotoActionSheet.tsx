import { useCallback, useRef, useState } from "react";
import { Alert, Linking, View, useColorScheme } from "react-native";
import ImageCropPicker from "react-native-image-crop-picker";
import { Button, Dialog, useThemeColor, useToast } from "heroui-native";
import { saveAttachment } from "@/features/classroom/ classroom.service";
import { ProfilePhotoActionSheet } from "@/features/profile/components/ProfilePhotoActionSheet";
import { useUpdateStudentPhoto } from "@/features/profile/useUpdateStudentPhoto";

type EditTarget = {
  profileId: number;
  currentPhoto?: string | null;
};

const CROP_DIM = 1024;
const CROP_QUALITY = 0.8;

// react-native-image-crop-picker error codes (string `code` property on Error).
const ERR_CANCELLED = "E_PICKER_CANCELLED";
const ERR_NO_LIB_PERM = "E_NO_LIBRARY_PERMISSION";
const ERR_NO_CAM_PERM = "E_NO_CAMERA_PERMISSION";

type CropPickerError = { code?: string; message?: string } & Error;

function isCancelled(err: unknown): boolean {
  return (err as CropPickerError | undefined)?.code === ERR_CANCELLED;
}

function isPermissionError(err: unknown): "library" | "camera" | null {
  const code = (err as CropPickerError | undefined)?.code;
  if (code === ERR_NO_LIB_PERM) return "library";
  if (code === ERR_NO_CAM_PERM) return "camera";
  return null;
}

export function useProfilePhotoActionSheet() {
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const { toast } = useToast();
  // heroui-native's toast.hide closes over the `toasts` state from the render
  // where the callback was created. By the time our async `finally` block runs,
  // the captured `toast` reference is stale — its `hide` looks at a `toasts`
  // snapshot that doesn't include the pending toast and silently no-ops.
  // The ref always points at the latest toast object so `hide(id)` works.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Pull theme tokens so the cropper (uCrop on Android) matches the app
  // chrome in both light and dark mode. The cropper UI on iOS is mostly
  // system-driven — these knobs primarily affect Android.
  const backgroundColor = useThemeColor("background");
  const foregroundColor = useThemeColor("foreground");
  const accentColor = useThemeColor("accent");

  const cropperTheme = {
    cropperToolbarColor: backgroundColor,
    cropperStatusBarColor: backgroundColor,
    cropperToolbarWidgetColor: foregroundColor,
    cropperActiveWidgetColor: accentColor,
    cropperTintColor: accentColor,
    cropperToolbarTitle: "Crop profile photo",
    cropperChooseText: "Use",
    cropperCancelText: "Cancel",
    cropperCircleOverlay: true,
    // uCrop's bottom controls panel (rotate/scale dial) doesn't honor the
    // toolbar colors — it has its own light-themed surface which clashes
    // hard in dark mode. For an avatar (fixed 1:1 aspect, pinch-zoom on the
    // image works as scale), the bottom controls are redundant — hide them.
    hideBottomControls: true,
    cropperRotateButtonsHidden: true,
    // Match the system bars to the cropper toolbar so the chrome reads as one
    // surface. `*Light: true` = light (white) icons, which is what we want
    // when the toolbar background is dark.
    cropperStatusBarLight: isDark,
    cropperNavigationBarLight: isDark,
  };

  const updateStudentPhoto = useUpdateStudentPhoto();

  const requestEdit = useCallback((next: EditTarget) => {
    setTarget(next);
    setShowSheet(true);
  }, []);

  const persistAndUpdate = useCallback(
    async (sourceUri: string) => {
      if (!target) return;
      const pendingId = toastRef.current.show({
        label: "Saving photo…",
        duration: "persistent",
      });
      try {
        const persistent = await saveAttachment(sourceUri);
        await updateStudentPhoto(target.profileId, persistent);
      } catch (err) {
        console.error("[useProfilePhotoActionSheet] persist failed:", err);
        toastRef.current.show({
          label: "Couldn't save that photo",
          description: "Please try again.",
          variant: "danger",
        });
      } finally {
        toastRef.current.hide(pendingId);
      }
    },
    [target, updateStudentPhoto],
  );

  // Common option shape — both flows share dimensions, compression, and
  // theme. The crop-picker library handles the resize step internally, so
  // we don't need expo-image-manipulator anymore.
  const sharedOptions = {
    width: CROP_DIM,
    height: CROP_DIM,
    cropping: true,
    compressImageQuality: CROP_QUALITY,
    compressImageMaxWidth: CROP_DIM,
    compressImageMaxHeight: CROP_DIM,
    mediaType: "photo" as const,
    ...cropperTheme,
  };

  const openSettingsAlert = (kind: "library" | "camera") => {
    Alert.alert(
      kind === "library"
        ? "Photo Library Permission Required"
        : "Camera Permission Required",
      kind === "library"
        ? "Enable photo library access in Settings to choose a profile photo."
        : "Enable camera access in Settings to take a profile photo.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ],
    );
  };

  const handlePickLibrary = useCallback(async () => {
    try {
      const image = await ImageCropPicker.openPicker(sharedOptions);
      if (!image?.path) return;
      await persistAndUpdate(image.path);
    } catch (err) {
      if (isCancelled(err)) return;
      const permKind = isPermissionError(err);
      if (permKind) {
        openSettingsAlert(permKind);
        return;
      }
      console.error("[useProfilePhotoActionSheet] openPicker failed:", err);
      toast.show({
        label: "Couldn't open photo library",
        description: "Please try again.",
        variant: "danger",
      });
    }
  }, [persistAndUpdate, sharedOptions, toast]);

  const handlePickCamera = useCallback(async () => {
    try {
      const image = await ImageCropPicker.openCamera({
        ...sharedOptions,
        useFrontCamera: true,
      });
      if (!image?.path) return;
      await persistAndUpdate(image.path);
    } catch (err) {
      if (isCancelled(err)) return;
      const permKind = isPermissionError(err);
      if (permKind) {
        openSettingsAlert(permKind);
        return;
      }
      console.error("[useProfilePhotoActionSheet] openCamera failed:", err);
      toast.show({
        label: "Couldn't open camera",
        description: "Please try again.",
        variant: "danger",
      });
    }
  }, [persistAndUpdate, sharedOptions, toast]);

  const handleRemove = useCallback(() => {
    if (!target) return;
    setShowRemoveDialog(true);
  }, [target]);

  const handleConfirmRemove = useCallback(async () => {
    if (!target) return;
    setShowRemoveDialog(false);
    try {
      await updateStudentPhoto(target.profileId, "");
    } catch (err) {
      console.error("[useProfilePhotoActionSheet] remove failed:", err);
      toastRef.current.show({
        label: "Couldn't remove the photo",
        description: "Please try again.",
        variant: "danger",
      });
    }
  }, [target, updateStudentPhoto]);

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
      <Dialog isOpen={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <View className="mb-5 gap-1.5">
              <Dialog.Title>Remove profile photo?</Dialog.Title>
              <Dialog.Description>
                Your initials will appear instead.
              </Dialog.Description>
            </View>
            <View className="flex-row justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowRemoveDialog(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" size="sm" onPress={handleConfirmRemove}>
                Remove
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );

  // isDark referenced so the hook re-runs and recomputes cropperTheme when the
  // scheme flips while the user is on this screen.
  void isDark;

  return { requestEdit, portal };
}
