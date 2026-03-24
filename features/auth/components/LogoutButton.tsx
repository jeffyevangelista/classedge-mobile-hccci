import { powersync } from "@/powersync/system";
import { Button, Dialog, useToast } from "heroui-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLogout } from "../auth.hooks";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";

const LogoutButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const { mutateAsync, isPending } = useLogout();

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
    try {
      await mutateAsync();
      await powersync.disconnectAndClear();
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Logout Failed",
        description: error?.message,
      });
    }
  };
  return (
    <>
      <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Trigger asChild>
          <Pressable className="active:opacity-70">
            {({ pressed }) => (
              <View
                className={`flex-row items-center p-3 rounded-2xl border border-transparent`}
              >
                <Icon name={"SignOut"} size={28} className="text-blue-500" />

                <AppText
                  weight="semibold"
                  className="text-base sm:text-lg ml-4 flex-1 text-slate-800"
                >
                  Logout
                </AppText>
              </View>
            )}
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
                <Text className="text-sm font-semibold text-danger">
                  You have {unsyncedCount} pending unsynced{" "}
                  {unsyncedCount === 1 ? "change" : "changes"} that will be
                  lost.
                </Text>
              )}
            </View>
            <View>
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
