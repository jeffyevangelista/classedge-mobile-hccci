import { useWindowDimensions, View } from "react-native";
import { Card } from "heroui-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

interface ErrorComponentProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorComponent({ message, onRetry }: ErrorComponentProps) {
  const { width } = useWindowDimensions();
  const iconSize = width < 640 ? 24 : width < 768 ? 28 : 32;

  return (
    <View className="flex-1 justify-center items-center px-5 sm:px-8 md:px-10">
      <Card className="shadow-none rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 max-w-md w-full">
        <Card.Body className="gap-4 sm:gap-5 md:gap-6 items-center">
          <View className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-red-100 dark:bg-red-900 rounded-full items-center justify-center">
            <Icon
              name="Warning"
              size={iconSize}
              className="text-red-600 dark:text-red-400"
            />
          </View>
          <View className="items-center gap-2 sm:gap-2.5">
            <AppText
              weight="semibold"
              className="text-red-900 dark:text-red-100 text-center text-base sm:text-lg md:text-xl"
            >
              Something went wrong
            </AppText>
            <AppText className="text-red-700 dark:text-red-300 text-center text-sm sm:text-base">
              {message}
            </AppText>
          </View>
          {onRetry && (
            <View className="w-full">
              <View
                className="bg-red-600 dark:bg-red-500 rounded-lg px-4 sm:px-5 py-2 sm:py-2.5 items-center"
                onTouchEnd={onRetry}
              >
                <AppText
                  weight="semibold"
                  className="text-white text-sm sm:text-base"
                >
                  Try Again
                </AppText>
              </View>
            </View>
          )}
        </Card.Body>
      </Card>
    </View>
  );
}
