import React from "react";
import {
  Modal,
  StatusBar,
  TouchableOpacity,
  View,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

interface Props {
  uri: string;
  fileName: string;
}

export const AttachmentVideoCard = ({ uri, fileName }: Props) => {
  const [fullscreen, setFullscreen] = React.useState(false);
  const mutedColor = useThemeColor("muted");

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setFullscreen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Play video ${fileName}`}
        className="flex-row items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3"
      >
        <View className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 items-center justify-center shrink-0">
          <Icon name="FilmSlateIcon" size={20} color="#9333ea" />
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
      </TouchableOpacity>

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
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
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
        >
          <Icon name="XIcon" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </>
  );
};
