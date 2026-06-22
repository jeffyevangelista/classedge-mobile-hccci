import { useRouter } from "expo-router";
import CameraViewScreen from "@/features/camera/components/CameraViewScreen";
import type { CapturedPhoto } from "@/features/camera/useCamera";

const CameraScreen = () => {
  const _router = useRouter();

  const handleCapture = (photo: CapturedPhoto) => {
    if (__DEV__) console.log("Photo captured:", photo.uri);
  };

  return <CameraViewScreen onCapture={handleCapture} />;
};

export default CameraScreen;
