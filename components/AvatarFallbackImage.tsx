import { Avatar } from "heroui-native";
import Image from "@/components/Image";

/**
 * Drop-in replacement for `<Avatar.Fallback>{initials}</Avatar.Fallback>` that
 * renders the shared avatar placeholder image instead of letter initials.
 * Use inside `<Avatar>` next to `<Avatar.Image>` / `<AttachmentAvatarImage>`.
 */
export const AvatarFallbackImage = () => (
  <Avatar.Fallback>
    <Image
      source={require("@/assets/placeholder/avatar-placeholder.png")}
      className="w-full h-full"
      contentFit="cover"
    />
  </Avatar.Fallback>
);

export default AvatarFallbackImage;
