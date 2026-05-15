import {
  RefreshControl,
  type RefreshControlProps,
} from "react-native";
import { useThemeColor } from "heroui-native";

type Props = Omit<
  RefreshControlProps,
  "tintColor" | "colors" | "progressBackgroundColor"
>;

export const RefreshIndicator = (props: Props) => {
  const foregroundColor = useThemeColor("foreground");
  const surfaceColor = useThemeColor("surface");

  return (
    <RefreshControl
      {...props}
      tintColor={foregroundColor}
      colors={[foregroundColor]}
      progressBackgroundColor={surfaceColor}
    />
  );
};
