import { useWindowDimensions, View } from "react-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

interface ErrorFallbackProps {
  message?: string;
  onRefetch?: () => void;
}

const ErrorFallback = ({
  message = "Something went wrong",
  onRefetch,
}: ErrorFallbackProps) => {
  const { width } = useWindowDimensions();
  const iconSize = width < 640 ? 56 : width < 768 ? 72 : 88;

  return (
    <View className="flex-1 items-center justify-center px-6 py-12 sm:py-16 md:py-20 gap-4 sm:gap-5 md:gap-6">
      <View className="p-4 sm:p-5 md:p-6 rounded-full bg-red-50 dark:bg-red-950">
        <Icon
          name="Warning"
          size={iconSize}
          className="text-red-500 dark:text-red-400"
        />
      </View>
      <View className="items-center gap-1.5 sm:gap-2 max-w-xs sm:max-w-sm md:max-w-md">
        <AppText
          weight="semibold"
          className="text-center text-lg sm:text-xl md:text-2xl text-slate-800 dark:text-white"
        >
          Oops!
        </AppText>
        <AppText className="text-center text-sm sm:text-base md:text-lg text-slate-400 dark:text-slate-500">
          {message}
        </AppText>
      </View>
      {onRefetch && (
        <View
          className="bg-red-600 dark:bg-red-500 rounded-lg px-6 sm:px-8 py-2.5 sm:py-3 items-center"
          onTouchEnd={onRefetch}
        >
          <AppText
            weight="semibold"
            className="text-white text-sm sm:text-base"
          >
            Try Again
          </AppText>
        </View>
      )}
    </View>
  );
};

export default ErrorFallback;
