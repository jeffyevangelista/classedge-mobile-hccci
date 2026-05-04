import { powersync, resetPowerSync } from "@/powersync/system";
import { Button, Dialog, useToast } from "heroui-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";

const ResyncButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

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

  const handleResync = async () => {
    setIsPending(true);
    setIsOpen(false);
    try {
      await resetPowerSync();
      toast.show({
        variant: "success",
        label: "Resync started",
        description: "Local data cleared. Re-downloading from server.",
      });
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Resync failed",
        description: error?.message ?? "Unknown error",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Pressable className="active:opacity-70">
          {() => (
            <View className="flex-row items-center p-3 rounded-2xl border border-transparent">
              <Icon
                name="ArrowsClockwiseIcon"
                size={28}
                className="text-accent"
              />
              <AppText
                weight="semibold"
                className="text-base sm:text-lg ml-4 flex-1 text-slate-800 dark:text-slate-100"
              >
                Force Resync
              </AppText>
            </View>
          )}
        </Pressable>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-lg mx-auto">
          <View className="mb-5 gap-3">
            <Dialog.Title>Force a fresh sync?</Dialog.Title>
            <Dialog.Description>
              This will clear all locally synced data and re-download
              everything from the server. Use this after sync-rule changes are
              deployed.
            </Dialog.Description>
            {unsyncedCount > 0 && (
              <AppText weight="semibold" className="text-sm text-danger">
                You have {unsyncedCount} pending unsynced{" "}
                {unsyncedCount === 1 ? "change" : "changes"} that will be lost.
              </AppText>
            )}
          </View>
          <View>
            <Button
              variant="danger"
              isDisabled={isPending}
              onPress={handleResync}
            >
              Yes, resync now
            </Button>
            <Button variant="ghost" onPress={() => setIsOpen(false)}>
              Cancel
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ResyncButton;
