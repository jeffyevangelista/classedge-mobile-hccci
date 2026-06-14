import { useState } from "react";
import { Alert, Modal, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { FullscreenPdfView } from "../components/FullscreenPdfView";

interface PdfPreview {
  openPdf: (uri: string) => Promise<void>;
  modal: React.ReactElement;
  opening: boolean;
}

/**
 * Shared PDF preview. On Android we hand the file to the system viewer
 * via IntentLauncher; if the intent throws (no registered PDF viewer or
 * a content-URI resolution failure) we surface an alert — the previous
 * WebView fallback rendered `ERR_NAME_NOT_RESOLVED` because Android's
 * WebView can't load `file://` PDFs natively. iOS uses an in-app
 * fullscreen WebView modal since WKWebView renders PDFs directly.
 * Consumers render the returned `modal` element somewhere in their tree.
 */
export const usePdfPreview = (): PdfPreview => {
  const [modalUri, setModalUri] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const openPdf = async (uri: string) => {
    if (opening) return;
    if (Platform.OS === "android") {
      setOpening(true);
      try {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync(
          "android.intent.action.VIEW",
          {
            data: contentUri,
            type: "application/pdf",
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          },
        );
      } catch (err) {
        console.warn("[usePdfPreview] Android intent failed:", err);
        Alert.alert(
          "Can't preview PDF",
          "No app on this device can open PDF files. Install a PDF viewer from the Play Store and try again.",
        );
      } finally {
        setOpening(false);
      }
      return;
    }
    setModalUri(uri);
  };

  const modal = (
    <Modal
      visible={modalUri != null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setModalUri(null)}
    >
      {modalUri != null ? (
        <FullscreenPdfView uri={modalUri} onClose={() => setModalUri(null)} />
      ) : null}
    </Modal>
  );

  return { openPdf, modal, opening };
};
