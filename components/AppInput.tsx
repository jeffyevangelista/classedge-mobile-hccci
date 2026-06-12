import { Input as HeroInput } from "heroui-native";
import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

type AppInputProps = React.ComponentProps<typeof HeroInput>;
type AppInputRef = React.ComponentRef<typeof HeroInput>;

// Drop-in replacement for heroui-native's `Input` that strips the iOS
// drop-shadow baked into the primary variant (`ios:shadow-field`). Android
// already renders nearly no shadow, so this gives us a consistent look
// across platforms. The inline style override is required because the
// Uniwind `ios:` variant isn't always overridden by a later `shadow-none`
// className alone — caller-supplied styles still win since they come
// later in the style array.
const AppInput = forwardRef<AppInputRef, AppInputProps>(
  ({ className, style, ...rest }, ref) => {
    return (
      <HeroInput
        ref={ref}
        className={twMerge("shadow-none", className)}
        style={[{ elevation: 0, shadowOpacity: 0 }, style]}
        {...rest}
      />
    );
  },
);

AppInput.displayName = "AppInput";

export default AppInput;
