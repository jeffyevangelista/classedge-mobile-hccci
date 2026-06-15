import { useRef } from "react";
import { Avatar } from "heroui-native";
import type { AvatarImageProps } from "heroui-native";
import { useAttachment } from "../hooks/useAttachment";

type Props = Omit<AvatarImageProps, "source"> & {
  path: string | null | undefined;
};

/**
 * Drop-in replacement for `<Avatar.Image source={{ uri: ... }} />` that resolves
 * the URI through the local attachment cache for server-managed paths.
 *
 * Local `file://` URIs (the pending-upload optimistic window for the profile
 * photo flow) bypass the cache and go straight to `Avatar.Image` — the cache
 * has no record of them, but they are accessible files that the underlying
 * renderer can read directly. Going through `Avatar.Image` (instead of a raw
 * RN `<Image>`) preserves the heroui-native Avatar root's "image loaded"
 * signal, so the surrounding `<Avatar.Fallback />` correctly hides itself
 * once the local image renders.
 *
 * Bridge: when an offline-written `file://` row transitions to a server path
 * after sync, the cache hasn't downloaded the bytes yet — a naive render
 * would briefly show null/fallback. We remember the last seen local URI and
 * keep showing it as a placeholder while the cache catches up. The file is
 * still physically present in DocumentDirectory/attachments during this
 * window. After server cleanup of the previous local file, the bridge
 * silently fails through to null — same as the pre-bridge behavior.
 */
export const AttachmentAvatarImage = ({ path, ...rest }: Props) => {
  const isLocalFile = path?.startsWith("file://") ?? false;
  // Always call useAttachment to keep hook order stable, but pass null for
  // local URIs so it short-circuits and doesn't try to query the cache.
  const { uri: cachedUri, state } = useAttachment(isLocalFile ? null : path);

  const lastLocalRef = useRef<string | null>(null);

  if (isLocalFile && path) {
    lastLocalRef.current = path;
    return <Avatar.Image source={{ uri: path }} {...(rest as AvatarImageProps)} />;
  }

  if (state === "synced" && cachedUri) {
    return <Avatar.Image source={{ uri: cachedUri }} {...(rest as AvatarImageProps)} />;
  }

  if (lastLocalRef.current) {
    return (
      <Avatar.Image
        source={{ uri: lastLocalRef.current }}
        {...(rest as AvatarImageProps)}
      />
    );
  }

  return null;
};

export default AttachmentAvatarImage;
