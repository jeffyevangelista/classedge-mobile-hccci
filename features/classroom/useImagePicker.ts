import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";

export type PickedImage = {
  uri: string;
};

export const useImagePicker = () => {
  const ensurePermission = async (): Promise<boolean> => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) return true;

    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!result.granted) {
      if (!result.canAskAgain) {
        Alert.alert(
          "Photo Library Permission Required",
          "Please enable photo library access in your device settings.",
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

  const pick = async (): Promise<PickedImage | null> => {
    const granted = await ensurePermission();
    if (!granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    return { uri: result.assets[0].uri };
  };

  return { ensurePermission, pick };
};
