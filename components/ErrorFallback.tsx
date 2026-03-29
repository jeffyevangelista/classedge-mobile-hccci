import { View } from "react-native";
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
  return (
    <View className="flex-1 items-center justify-center py-10 gap-5">
      <View className="p-5 rounded-full bg-red-100 dark:bg-red-900">
        <Icon
          name="Warning"
          size={64}
          className="text-red-600 dark:text-red-400"
        />
      </View>
      <View className="items-center gap-1">
        <AppText
          weight="semibold"
          className="text-center text-xl dark:text-white"
        >
          Oops!
        </AppText>
        <AppText className="text-center text-sm text-slate-500 dark:text-slate-400">
          {message}
        </AppText>
      </View>
      {onRefetch && (
        <View
          className="bg-red-600 dark:bg-red-500 rounded-lg px-6 py-2.5 items-center"
          onTouchEnd={onRefetch}
        >
          <AppText weight="semibold" className="text-white">
            Try Again
          </AppText>
        </View>
      )}
    </View>
  );
};

export default ErrorFallback;
