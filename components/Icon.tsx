import * as PhosphorIcons from "phosphor-react-native";
import { withUniwind } from "uniwind";

export type IconName = keyof typeof PhosphorIcons;

interface IconProps extends PhosphorIcons.IconProps {
  name: IconName;
}

const IconBase = ({ name, ...props }: IconProps) => {
  const IconComponent = PhosphorIcons[name] as React.ElementType;

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in phosphor-react-native`);
    return null;
  }

  return <IconComponent {...props} />;
};

export const Icon = withUniwind(IconBase);
