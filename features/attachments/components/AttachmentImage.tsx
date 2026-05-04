import { type ImageProps } from "expo-image";
import Image from "@/components/Image";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useAttachment } from "../hooks/useAttachment";

type Props = Omit<ImageProps, "source"> & {
  path: string | null | undefined;
  fallback?: React.ReactNode;
  showRetry?: boolean;
  className?: string;
};

export const AttachmentImage = ({
  path,
  fallback,
  showRetry = true,
  style,
  className,
  ...rest
}: Props) => {
  const { uri, state, retry } = useAttachment(path);

  if (state === "synced" && uri) {
    return (
      <Image source={{ uri }} style={style} className={className} {...rest} />
    );
  }

  if (state === "failed") {
    const fallbackLayer = fallback ?? (
      <View className="absolute inset-0 items-center justify-center bg-foreground/5">
        <Icon name="ImageIcon" size={20} />
      </View>
    );

    if (!showRetry) {
      return <>{fallbackLayer}</>;
    }

    return (
      <View style={style} className={className}>
        {fallbackLayer}
        <Pressable
          onPress={retry}
          className="absolute inset-0 items-center justify-center bg-black/40"
        >
          <Icon name="ArrowsClockwiseIcon" size={16} color="#fff" />
          <AppText className="text-white text-xs mt-1">Tap to retry</AppText>
        </Pressable>
      </View>
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <View
      style={style}
      className={`items-center justify-center bg-foreground/5 ${className ?? ""}`}
    >
      <Icon name="ImageIcon" size={20} />
    </View>
  );
};

export default AttachmentImage;
