import { useNavigation } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable } from "react-native";
import { Icon } from "@/components/Icon";

const HamburgerButton = () => {
  const navigation = useNavigation<any>();
  const tint = useThemeColor("foreground");
  return (
    <Pressable
      onPress={() => {
        const drawerNav = navigation.getParent?.("drawer");
        if (drawerNav?.openDrawer) {
          drawerNav.openDrawer();
        } else if (navigation.openDrawer) {
          navigation.openDrawer();
        }
      }}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      hitSlop={8}
      className="p-2 active:opacity-60"
    >
      <Icon name="ListIcon" size={22} color={tint} />
    </Pressable>
  );
};

export default HamburgerButton;
