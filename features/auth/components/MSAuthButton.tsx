import MsLogo from "@/assets/ms-logo.svg";
import { Button, Spinner, useThemeColor, useToast } from "heroui-native";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { startMicrosoftLogin } from "../authService";

const MSAuthButton = () => {
  const { toast } = useToast();
  const oauthPhase = useStore((s) => s.oauthPhase);
  const themeColorAccentForeground = useThemeColor("accent-foreground");

  const isInFlight = oauthPhase !== "idle";

  const handleSignIn = async () => {
    if (isInFlight) return;
    try {
      await startMicrosoftLogin();
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Sign-in failed",
        description: getApiErrorMessage(error),
      });
    }
  };

  return (
    <Button
      className="w-full"
      variant="primary"
      size="lg"
      onPress={handleSignIn}
      isDisabled={isInFlight}
    >
      {isInFlight ? (
        <Spinner color={themeColorAccentForeground} />
      ) : (
        <>
          <MsLogo width={24} height={24} />
          <Button.Label>Continue with Microsoft</Button.Label>
        </>
      )}
    </Button>
  );
};

export default MSAuthButton;
