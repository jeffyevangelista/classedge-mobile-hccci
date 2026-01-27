import { colors } from "@/utils/colors";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { twMerge } from "tailwind-merge";

type ScreenProps = {
  children: React.ReactNode;
  safeArea?: boolean;
  className?: string;
  withPadding?: boolean;
} & React.ComponentProps<typeof View> &
  React.ComponentProps<typeof SafeAreaView>;

export default function Screen({
  children,
  safeArea = false,
  className,
  withPadding = false,
  ...props
}: ScreenProps) {
  const combinedClasses = twMerge(`flex-1 `, withPadding && "p-5", className);

  const Container = safeArea ? SafeAreaView : View;

  return (
    <Container
      style={{ backgroundColor: colors.backgroundColor }}
      {...props}
      className={combinedClasses}
    >
      {children}
    </Container>
  );
}
