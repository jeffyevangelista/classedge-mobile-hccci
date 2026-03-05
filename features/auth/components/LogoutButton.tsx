import {
  Button,
  Dialog,
  Spinner,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useState } from "react";
import { useLogout } from "../auth.hooks";
import { View } from "react-native";
import { powersync } from "@/powersync/system";

const LogoutButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const themeColorAccentForeground = useThemeColor("danger-foreground");

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
        variant="ghost"
        onPress={() => setIsOpen(true)}
      >
        {isPending ? (
          <Spinner color={themeColorAccentForeground} />
        ) : (
          <>
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
