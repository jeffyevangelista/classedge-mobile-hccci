import { Avatar } from "heroui-native";
import type { AvatarImageProps } from "heroui-native";
import { useAttachment } from "../hooks/useAttachment";

type Props = Omit<AvatarImageProps, "source"> & {
  path: string | null | undefined;
};

/**
 * Drop-in replacement for `<Avatar.Image source={{ uri: ... }} />` that resolves
 * the URI through the local attachment cache. Renders nothing while the
 * attachment is queued/downloading, so the surrounding `<Avatar.Fallback />`
 * (if any) takes over until the bytes are on disk.
 */
export const AttachmentAvatarImage = ({ path, ...rest }: Props) => {
  const { uri, state } = useAttachment(path);

  if (state !== "synced" || !uri) return null;

  return <Avatar.Image source={{ uri }} {...(rest as AvatarImageProps)} />;
};

export default AttachmentAvatarImage;
