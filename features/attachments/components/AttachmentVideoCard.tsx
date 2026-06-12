import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StatusBar,
  View,
} from "react-native";
import { useEvent } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

// Video attachments use a purple identity, distinct from image (teal) and
// PDF (red) so file types are recognizable at a glance.
const VIDEO_ICON_COLOR = "#9333ea";

interface Props {
  uri: string;
  fileName: string;
}

export const AttachmentVideoCard = ({ uri, fileName }: Props) => {
  const [fullscreen, setFullscreen] = React.useState(false);
  const mutedColor = useThemeColor("muted");

  return (
    <>
      <Pressable
        onPress={() => setFullscreen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Play video ${fileName}`}
        android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
        className="flex-row items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3 active:opacity-70"
      >
        <View className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 items-center justify-center shrink-0">
          <Icon name="FilmSlateIcon" size={20} color={VIDEO_ICON_COLOR} />
        </View>
        <View className="flex-1">
          <AppText
            numberOfLines={1}
            ellipsizeMode="tail"
            className="text-sm"
          >
            {fileName}
          </AppText>
          <AppText className="text-xs text-muted mt-0.5">Tap to play</AppText>
        </View>
        <Icon name="PlayIcon" size={16} color={mutedColor} />
      </Pressable>

      <Modal
        visible={fullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreen(false)}
      >
        {fullscreen ? (
          <FullscreenVideoView
            uri={uri}
            onClose={() => setFullscreen(false)}
          />
        ) : null}
      </Modal>
    </>
  );
};

const FullscreenVideoView = ({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) => {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
    p.play();
  });
  // `expo-video` emits `statusChange` events as the player transitions
  // through loading → readyToPlay → error. The spinner stays visible
  // until the player either reaches `readyToPlay` or errors out, so
  // the user gets feedback during the initial buffer.
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  const isLoading = status === "loading";

  return (
    <>
      <StatusBar hidden={false} barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <VideoView
          player={player}
          style={{ flex: 1, backgroundColor: "#000" }}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
        {isLoading ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        ) : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
          hitSlop={8}
          style={{
            position: "absolute",
            top: 60,
            right: 16,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.55)",
            borderRadius: 22,
            zIndex: 100001,
          }}
          className="active:opacity-70"
        >
          <Icon name="XIcon" size={24} color="#ffffff" />
        </Pressable>
      </View>
    </>
  );
};
