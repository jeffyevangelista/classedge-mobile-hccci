import CameraViewScreen from "@/features/camera/components/CameraViewScreen";
import { useRouter } from "expo-router";
import type { CapturedPhoto } from "@/features/camera/useCamera";

const CameraScreen = () => {
  const router = useRouter();

  const handleCapture = (photo: CapturedPhoto) => {
    console.log("Photo captured:", photo.uri);
  };

  return <CameraViewScreen onCapture={handleCapture} />;
};

export default CameraScreen;
