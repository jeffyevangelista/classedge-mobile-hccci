import type { IconProps } from "phosphor-react-native";
import type { ComponentType } from "react";
import type { StyleProp, ViewStyle, TextStyle } from "react-native";
import { withUniwind } from "uniwind";

interface ReusableIconProps extends Omit<IconProps, "style"> {
  // Use ComponentType to accept both Phosphor and Heroicons
  as: ComponentType<any>;
  className?: string;
  style?: StyleProp<ViewStyle | TextStyle>;
}

export const Icon = ({
  as: IconComponent,
  className,
  ...props
}: ReusableIconProps) => {
  // We cast the component through withUniwind
  const UniwindIcon = withUniwind(IconComponent);

  return <UniwindIcon className={className} {...props} />;
};
