import { AppText } from "@/components/AppText";
import { useRefreshExpiry } from "@/features/auth/refreshExpiry";
import { setMMKVItem } from "@/lib/storage/mmkv-storage";
import { captureAuthMessage } from "@/lib/telemetry";
import { MMKV_KEYS } from "@/utils/storage-keys";
import { Button, Dialog } from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

const RefreshExpiryModal = () => {
  const { shouldShowModal } = useRefreshExpiry();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldShowModal) {
      setOpen(true);
      captureAuthMessage("refresh_expiry_modal_shown");
    }
  }, [shouldShowModal]);

  const dismiss = () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    setMMKVItem(MMKV_KEYS.LAST_REFRESH_EXPIRY_WARNING_SHOWN, todayIso);
    captureAuthMessage("refresh_expiry_modal_dismissed");
    setOpen(false);
  };

  return (
    <Dialog isOpen={open} onOpenChange={(o) => (!o ? dismiss() : null)}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-lg mx-auto">
          <View className="mb-5 gap-3">
            <Dialog.Title>Session expires today</Dialog.Title>
            <Dialog.Description>
              Your offline session ends today. Reconnect to the internet
              now to keep your unsynced changes from being lost.
            </Dialog.Description>
            <AppText className="text-xs text-muted">
              You can keep working, but anything you change after the
              session expires may not be uploaded.
            </AppText>
          </View>
          <Button onPress={dismiss}>OK</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default RefreshExpiryModal;
