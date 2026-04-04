import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Alert, Linking } from "react-native";

export type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
  base64?: string;
};

export const useCamera = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const ensurePermission = async (): Promise<boolean> => {
    if (permission?.granted) return true;

    const result = await requestPermission();
    if (!result.granted) {
      if (!result.canAskAgain) {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
      }
      return false;
    }
    return true;
  };

  const takePicture = async (): Promise<CapturedPhoto | null> => {
    if (!cameraRef.current) return null;

    const result = await cameraRef.current.takePictureAsync({
      quality: 0.8,
      base64: false,
    });

    if (result) {
      const captured: CapturedPhoto = {
        uri: result.uri,
        width: result.width,
        height: result.height,
      };
      setPhoto(captured);
      return captured;
    }
    return null;
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const toggleFlash = () => {
    setFlash((prev) => (prev === "off" ? "on" : "off"));
  };

  const resetPhoto = () => {
    setPhoto(null);
  };

  return {
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
  };
};
