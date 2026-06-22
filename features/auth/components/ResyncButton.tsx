import { Button, Dialog, useToast } from "heroui-native";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import ProfileRow from "@/features/profile/components/ProfileRow";
import { powersync, resetPowerSync } from "@/powersync/system";

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.show({
        variant: "danger",
        label: "Resync failed",
        description: message,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <ProfileRow icon="ArrowsClockwiseIcon" label="Force Resync" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-lg mx-auto">
          <View className="mb-5 gap-3">
            <Dialog.Title>Force a fresh sync?</Dialog.Title>
            <Dialog.Description>
              This will clear all locally synced data and re-download everything
              from the server. Use this after sync-rule changes are deployed.
            </Dialog.Description>
            {unsyncedCount > 0 && (
              <AppText weight="semibold" className="text-sm text-danger">
                You have {unsyncedCount} pending unsynced{" "}
                {unsyncedCount === 1 ? "change" : "changes"} that will be lost.
              </AppText>
            )}
          </View>
          <View className="gap-2">
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
