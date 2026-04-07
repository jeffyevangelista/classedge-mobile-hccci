import { useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, IconName } from "@/components/Icon";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
}

const EmptyState = ({ icon, title, description }: EmptyStateProps) => {
  const { width } = useWindowDimensions();
  const iconSize = width < 640 ? 56 : width < 768 ? 72 : 88;

  return (
    <View className="flex-1 items-center justify-center px-6 py-12 sm:py-16 md:py-20 gap-4 sm:gap-5 md:gap-6">
      <View className="p-4 sm:p-5 md:p-6 rounded-full bg-blue-50 dark:bg-blue-950">
        <Icon
          name={icon}
          size={iconSize}
          className="text-blue-500 dark:text-blue-400"
        />
      </View>
      <View className="items-center gap-1.5 sm:gap-2 max-w-xs sm:max-w-sm md:max-w-md">
        <AppText
          weight="semibold"
          className="text-center text-lg sm:text-xl md:text-2xl text-slate-800 dark:text-white"
        >
          {title}
        </AppText>
        {description && (
          <AppText className="text-center text-sm sm:text-base md:text-lg text-slate-400 dark:text-slate-500">
            {description}
          </AppText>
        )}
      </View>
    </View>
  );
};

export default EmptyState;
