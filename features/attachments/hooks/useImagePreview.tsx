import { useState } from "react";
import { Modal } from "react-native";
import { FullscreenImageView } from "../components/FullscreenImageView";

interface ImagePreview {
  openImage: (uri: string) => void;
  modal: React.ReactElement;
}

/**
 * Local image preview, mirroring `usePdfPreview`. Used for already-known
 * URIs (the picker's `file://` path) where the global `ImageProvider`'s
 * expo-image renderer has been unreliable. Consumers render the returned
 * `modal` element somewhere in their tree.
 */
export const useImagePreview = (): ImagePreview => {
  const [uri, setUri] = useState<string | null>(null);

  const openImage = (target: string) => {
    setUri(target);
  };

  const modal = (
    <Modal
      visible={uri != null}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={() => setUri(null)}
    >
      {uri != null ? (
        <FullscreenImageView uri={uri} onClose={() => setUri(null)} />
      ) : null}
    </Modal>
  );

  return { openImage, modal };
};
