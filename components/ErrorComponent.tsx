import { View } from "react-native";
import { Card } from "heroui-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

interface ErrorComponentProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorComponent({ message, onRetry }: ErrorComponentProps) {
  return (
    <View className="flex-1 justify-center items-center px-5">
      <Card className="shadow-none rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 max-w-md w-full">
        <Card.Body className="gap-4 items-center">
          <View className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full items-center justify-center">
            <Icon
              name="Warning"
              size={24}
              className="text-red-600 dark:text-red-400"
            />
          </View>
          <View className="items-center gap-2">
            <AppText
              weight="semibold"
              className="text-red-900 dark:text-red-100 text-center"
            >
              Something went wrong
            </AppText>
            <AppText className="text-red-700 dark:text-red-300 text-center text-sm">
              {message}
            </AppText>
          </View>
          {onRetry && (
            <View className="w-full">
              <View
                className="bg-red-600 dark:bg-red-500 rounded-lg px-4 py-2 items-center"
                onTouchEnd={onRetry}
              >
                <AppText weight="semibold" className="text-white">
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
