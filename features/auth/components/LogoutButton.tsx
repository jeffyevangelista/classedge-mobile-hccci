import {
  Button,
  Dialog,
  Spinner,
  useThemeColor,
  useToast,
} from "heroui-native";
import React, { useState } from "react";
import { useLogout } from "../auth.hooks";
import { View } from "react-native";
import { powersync } from "@/powersync/system";
import { Icon } from "@/components/Icon";
import { SignOutIcon } from "phosphor-react-native";

const LogoutButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const themeColorAccentForeground = useThemeColor("accent-foreground");
  const themeColorDangerSoftForeground = useThemeColor(
    "danger-soft-foreground",
  );
  const { mutateAsync, isPending } = useLogout();

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
      <Button
        isDisabled={isPending}
        variant="danger-soft"
        className="w-full"
        onPress={() => setIsOpen(true)}
      >
        {isPending ? (
          <Spinner color={themeColorAccentForeground} />
        ) : (
          <>
            <Icon as={SignOutIcon} color={themeColorDangerSoftForeground} />
            <Button.Label>Logout</Button.Label>
          </>
        )}
      </Button>

      <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="max-w-xl w-full mx-auto">
            <View className="mb-5 gap-1.5">
              <Dialog.Title>Are you sure?</Dialog.Title>
              <Dialog.Description>
                You are about to logout. Are you sure you want to proceed?
              </Dialog.Description>
            </View>
            <View className="flex-row justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  <Button.Label>Cancel</Button.Label>
                </Button>
              </Dialog.Close>
              <Button variant="danger" size="sm" onPress={handleLogout}>
                <Button.Label>Logout</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
};

export default LogoutButton;
