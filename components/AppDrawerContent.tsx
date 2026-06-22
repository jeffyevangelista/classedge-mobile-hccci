import {
  type DrawerContentComponentProps,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import {
  type RelativePathString,
  router,
  useGlobalSearchParams,
} from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import DrawerDecoration from "@/components/DrawerDecoration";
import { Icon } from "@/components/Icon";
import {
  getDrawerItems,
  getRoleTabPath,
  type ViewKey,
} from "@/features/auth/roleNav";
import useStore from "@/lib/store";

const HEADER_HEIGHT = 56;

const AppDrawerContent = (props: DrawerContentComponentProps) => {
  const { authUser } = useStore();
  const insets = useSafeAreaInsets();
  const foregroundColor = useThemeColor("foreground");
  const accentForegroundColor = useThemeColor("accent-foreground");

  const items = getDrawerItems(authUser?.role);
  const roleTabPath = getRoleTabPath(authUser?.role);
  const { view: activeView = "current" } = useGlobalSearchParams<{
    view?: ViewKey;
  }>();

  const onItemPress = (view: ViewKey) => {
    if (!roleTabPath) return;
    router.replace({
      pathname: roleTabPath as RelativePathString,
      params: { view },
    });
    props.navigation.closeDrawer();
  };

  // Group items by section (a section spans consecutive items sharing the same name).
  const sections: { name?: string; items: typeof items }[] = [];
  for (const item of items) {
    if (!item.section) {
      sections.push({ items: [item] });
      continue;
    }
    const last = sections.at(-1);
    if (last?.name === item.section) last.items.push(item);
    else sections.push({ name: item.section, items: [item] });
  }

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        paddingTop: insets.top + HEADER_HEIGHT,
        flexGrow: 1,
      }}
    >
      {sections.map((section, sIdx) => (
        <View key={section.name ?? `s${sIdx}`} className="px-2 pt-3">
          {section.name && (
            <AppText className="text-[10px] text-muted tracking-wider uppercase px-3 pb-1">
              {section.name}
            </AppText>
          )}
          {section.items.map((item) => {
            const isActive = item.view === activeView;
            return (
              <Pressable
                key={item.view}
                onPress={() => onItemPress(item.view)}
                className={`flex-row items-center gap-3 px-3 h-14 rounded-xl my-0.5 active:opacity-70 ${
                  isActive ? "bg-accent" : "bg-transparent"
                }`}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  color={isActive ? accentForegroundColor : foregroundColor}
                />
                <AppText
                  style={{
                    fontFamily: isActive
                      ? "Poppins-SemiBold"
                      : "Poppins-Medium",
                  }}
                  className={`text-base ${
                    isActive ? "text-accent-foreground" : "text-foreground"
                  }`}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
      <DrawerDecoration />
    </DrawerContentScrollView>
  );
};

export default AppDrawerContent;
