import MsLogo from "@/assets/ms-logo.svg";
import { Button } from "heroui-native";

const MSAuthButton = () => {
  return (
    <Button isIconOnly size="lg" variant="ghost">
      <MsLogo width={32} height={32} />
    </Button>
  );
};

export default MSAuthButton;
