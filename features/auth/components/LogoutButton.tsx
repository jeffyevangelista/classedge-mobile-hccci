import { powersync } from "@/powersync/system";
import useStore from "@/lib/store";
import { clearAllAttachments } from "@/features/attachments/attachments.api";
import { Button, Dialog, useThemeColor, useToast } from "heroui-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";

const LogoutButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const accentColor = useThemeColor("accent");

  const checkUnsyncedData = useCallback(async () => {
    const result = await powersync.getAll<{ count: number }>(
      "SELECT count(*) as count FROM ps_crud",
    );
    setUnsyncedCount(result[0]?.count ?? 0);
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkUnsyncedData();
    }
  }, [isOpen, checkUnsyncedData]);

  const { toast } = useToast();
  const handleLogout = async () => {
    setIsPending(true);
    setIsOpen(false);
    try {
      await clearAllAttachments();
      await powersync.disconnectAndClear();
      await useStore.getState().clearCredentials();
    } catch (err: unknown) {
      setIsPending(false);
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      toast.show({
        variant: "danger",
        label: "Logout Failed",
        description: message,
      });
    }
  };
  return (
    <>
      <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Trigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Logout"
            className="active:opacity-70"
          >
            <View className="flex-row items-center p-3 rounded-2xl border border-transparent">
              <Icon name="SignOutIcon" size={28} color={accentColor} />

              <AppText
                weight="semibold"
                className="text-base sm:text-lg ml-4 flex-1"
              >
                Logout
              </AppText>
            </View>
          </Pressable>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="w-full max-w-lg mx-auto">
            <View className="mb-5 gap-3">
              <Dialog.Title>Confirm Logout</Dialog.Title>
              <Dialog.Description>
                Are you sure you want to log out? All local data will be cleared
                and this action cannot be undone.
              </Dialog.Description>
              {unsyncedCount > 0 && (
                <AppText weight="semibold" className="text-sm text-danger">
                  You have {unsyncedCount} pending unsynced{" "}
                  {unsyncedCount === 1 ? "change" : "changes"} that will be
                  lost.
                </AppText>
              )}
            </View>
            <View className="gap-2">
              <Button
                variant="danger"
                isDisabled={isPending}
                onPress={handleLogout}
              >
                Yes, Log me out
              </Button>
              <Button variant="ghost" onPress={() => setIsOpen(false)}>
                No, Cancel
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
};

export default LogoutButton;
