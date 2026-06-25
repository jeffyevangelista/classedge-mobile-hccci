import {
  Button,
  Dialog,
  Spinner,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { signOut } from "@/features/auth/signOut";
import ProfileRow from "@/features/profile/components/ProfileRow";
import { powersync } from "@/powersync/system";

const LogoutButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const dangerColor = useThemeColor("danger");

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
    // Dismiss the dialog BEFORE signOut runs. Letting the auth gate
    // unmount the (main) tree with the Portal still mounted races the
    // reanimated portal teardown with the native view destruction and
    // crashes Android with a dispatchGetDisplayList NPE. Wait for the
    // exit animation + unmount to settle before tearing down credentials.
    setIsOpen(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    try {
      await signOut();
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

  // Block all dismissal paths (overlay tap, back press) while signOut runs;
  // otherwise users can land in a half-signed-out state.
  const onOpenChange = (next: boolean) => {
    if (isPending) return;
    setIsOpen(next);
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <ProfileRow
          icon="SignOutIcon"
          label="Logout"
          iconColor={dangerColor}
          labelClassName="text-danger"
        />
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
                {unsyncedCount === 1 ? "change" : "changes"} that will be lost.
              </AppText>
            )}
          </View>
          <View className="gap-2">
            <Button
              variant="danger"
              onPress={handleLogout}
              isDisabled={isPending}
            >
              {isPending ? (
                <Spinner size="sm" color="#FFFFFF" />
              ) : (
                <Button.Label>Yes, Log me out</Button.Label>
              )}
            </Button>
            <Button
              variant="ghost"
              onPress={() => setIsOpen(false)}
              isDisabled={isPending}
            >
              No, Cancel
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default LogoutButton;
