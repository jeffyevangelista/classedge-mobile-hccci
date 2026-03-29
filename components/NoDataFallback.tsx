import { View } from "react-native";
import { AppText } from "./AppText";
import { Icon, IconName } from "./Icon";

interface NoDataFallbackProps {
  icon?: IconName;
  title?: string;
  description?: string;
  onRefetch?: () => void;
}

const NoDataFallback = ({
  icon = "SmileySad",
  title = "No data found",
  description,
  onRefetch,
}: NoDataFallbackProps) => {
  return (
    <View className="flex-1 items-center justify-center py-10 gap-5">
      <View className="p-5 rounded-full bg-blue-100 dark:bg-blue-900">
        <Icon
          name={icon}
          size={64}
          className="text-blue-600 dark:text-blue-400"
        />
      </View>
      <View className="items-center gap-1">
        <AppText className="text-center text-xl dark:text-white">
          {title}
        </AppText>
        {description && (
          <AppText className="text-center text-sm text-slate-500 dark:text-slate-400">
            {description}
          </AppText>
        )}
      </View>
      {onRefetch && (
        <View
          className="bg-blue-600 dark:bg-blue-500 rounded-lg px-6 py-2.5 items-center"
          onTouchEnd={onRefetch}
        >
          <AppText weight="semibold" className="text-white">
            Refresh
          </AppText>
        </View>
      )}
    </View>
  );
};

export default NoDataFallback;
