import { AppText } from "@/components/AppText";
import {
  consumeForcedLogoutNotice,
  type ForcedLogoutNotice,
} from "@/features/auth/forcedLogoutNotice";
import { Button, Dialog } from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

const ForcedLogoutNoticeDialog = () => {
  const [notice, setNotice] = useState<ForcedLogoutNotice | null>(null);

  useEffect(() => {
    const consumed = consumeForcedLogoutNotice();
    if (consumed) setNotice(consumed);
  }, []);

  if (!notice) return null;

  const { unsyncedCount } = notice;
  const hasUnsynced = unsyncedCount > 0;

  return (
    <Dialog
      isOpen={true}
      onOpenChange={(open) => {
        if (!open) setNotice(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-lg mx-auto">
          <View className="mb-5 gap-3">
            <Dialog.Title>Session Expired</Dialog.Title>
            <Dialog.Description>
              Your previous session has ended. Please sign in again to
              continue.
            </Dialog.Description>
            {hasUnsynced && (
              <AppText weight="semibold" className="text-sm text-danger">
                {unsyncedCount} unsaved{" "}
                {unsyncedCount === 1 ? "change was" : "changes were"} not
                uploaded and could not be recovered.
              </AppText>
            )}
          </View>
          <Button onPress={() => setNotice(null)}>OK</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ForcedLogoutNoticeDialog;
