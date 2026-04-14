import { RelativePathString, useRouter } from "expo-router";
import { ColorValue, Platform, Pressable } from "react-native";
import { Icon } from "./Icon";

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
        } else if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/" as RelativePathString);
        }
      }}
    >
      <Icon
        name="ArrowLeftIcon"
        color={tintColor as string}
        style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }} // adjust visual centering for iOS
      />
    </Pressable>
  );
};

export default BackButton;
