import { RelativePathString, useRouter } from "expo-router";
import { ColorValue, Platform, Pressable } from "react-native";
import { Icon } from "./Icon";
import { ArrowLeftIcon } from "phosphor-react-native";

interface BackButtonProps {
  tintColor?: ColorValue;
  to?: RelativePathString;
}

const BackButton = ({ tintColor, to }: BackButtonProps) => {
  const router = useRouter();

  return (
    <Pressable
      className="w-9 h-9 rounded-full flex justify-center items-center"
      onPress={() => {
        if (to) {
          router.push(to);
        } else {
          router.back();
        }
      }}
    >
      <Icon
        as={ArrowLeftIcon}
        style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }} // adjust visual centering for iOS
      />
    </Pressable>
  );
};

export default BackButton;
