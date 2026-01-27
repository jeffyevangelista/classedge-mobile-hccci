import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { tv, type VariantProps } from "tailwind-variants";

const textVariants = tv({
  base: "font-sans text-foreground", // Default Poppins-Regular from global.css
  variants: {
    weight: {
      regular: "font-sans", // Maps to --font-normal
      bold: "font-bold", // Maps to --font-bold
      semibold: "font-semibold", // Maps to --font-semibold
    },
    italic: {
      true: "italic",
      false: "",
    },
  },
  defaultVariants: {
    weight: "regular",
  },
});

type TextProps = VariantProps<typeof textVariants> &
  Omit<RNTextProps, "className"> & {
    className?: string;
  };

export function AppText({ weight, italic, className, ...props }: TextProps) {
  return (
    <RNText
      className={textVariants({ weight, italic, className })}
      {...props}
    />
  );
}
