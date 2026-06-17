import { Drawer } from "expo-router/drawer";
import { useThemeColor } from "heroui-native";
import AppDrawerContent from "@/components/AppDrawerContent";
import useStore from "@/lib/store";

const DrawerLayout = () => {
  const { authUser } = useStore();
  const isTimeKeeper = authUser?.role === "Time Keeper";
  const surfaceColor = useThemeColor("surface");

  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        swipeEnabled: !isTimeKeeper,
        drawerStyle: { width: "78%", backgroundColor: surfaceColor },
      }}
    />
  );
};

export default DrawerLayout;
