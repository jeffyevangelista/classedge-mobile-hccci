import React from "react";
import {
  Modal,
  StatusBar,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
        className="flex-row items-center gap-3 bg-default rounded-xl px-4 py-3"
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: "#000",
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: 6,
            }}
          >
            <Icon name="XIcon" size={20} color="#e5e5e5" />
          </TouchableOpacity>
        </View>
        <VideoView
          player={player}
          style={{ flex: 1, backgroundColor: "#000" }}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
      </SafeAreaView>
    </>
  );
};
