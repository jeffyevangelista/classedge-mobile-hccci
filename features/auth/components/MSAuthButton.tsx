import MsLogo from "@/assets/ms-logo.svg";
import { Icon } from "@/components/Icon";
import { Button, useThemeColor } from "heroui-native";
import { SquaresFourIcon } from "phosphor-react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

const MSAuthButton = () => {
  const [defaultForeground] = useThemeColor(["default-foreground"]);
  return (
    <Button
      // pressableFeedbackVariant="highlight"
      className="w-full"
      variant="primary"
      size="lg"
    >
      <MsLogo width={24} height={24} />

      <Button.Label>Continue with Microsoft</Button.Label>
    </Button>
  );
};

export default MSAuthButton;
