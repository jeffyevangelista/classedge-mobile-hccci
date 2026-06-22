import { Image } from "expo-image";
import { Skeleton } from "heroui-native";
import { Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useAttachment } from "../hooks/useAttachment";

type Props = {
  path: string;
  size?: number;
};

/**
 * useAttachment-backed thumbnail. Mirrors AttachmentAvatarImage but renders a
 * square thumbnail with explicit pending / failed states. Tap-to-retry on failure.
 */
export const AttachmentThumbnailImage = ({ path, size = 40 }: Props) => {
  const { uri, state, retry } = useAttachment(path);

  if (state === "synced" && uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 8 }}
        contentFit="cover"
      />
    );
  }

  if (state === "failed") {
    return (
      <Pressable
        onPress={retry}
        style={[styles.fallback, { width: size, height: size }]}
      >
        <Icon name="ImageBroken" size={size * 0.5} color="#9ca3af" />
      </Pressable>
    );
  }

  return <Skeleton style={{ width: size, height: size, borderRadius: 8 }} />;
};

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default AttachmentThumbnailImage;
