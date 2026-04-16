import { useVideoPlayer, VideoView } from "expo-video";
import * as WebBrowser from "expo-web-browser";
import { Card } from "heroui-native";
import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "./Icon";
import { AppText } from "./AppText";
import { useImage } from "@/providers/ImageProvider";

const FileRenderer = ({ url }: { url: any }) => {
  const { lessonFile, lessonUrl } = url;

  // Move hooks to component level
  const { showImage } = useImage();
  const [showVideo, setShowVideo] = useState(false);
  const player = useVideoPlayer(lessonFile || "", (player) => {
    player.loop = true;
  });

  const renderUrlLink = () => {
    if (!lessonUrl) return null;

    return (
      <Pressable
        onPress={async () => {
          await WebBrowser.openBrowserAsync(lessonUrl!);
        }}
      >
        <Card className="shadow-none rounded-xl max-w-3xl flex-row items-center gap-2.5 mt-2.5 dark:bg-neutral-800/50">
          <View className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/50">
            <Icon
              className="h-10 w-10 text-primary-600 dark:text-primary-400"
              name="LinkIcon"
            />
          </View>
          <View className="flex-1">
            <AppText
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-neutral-900 dark:text-neutral-100 leading-tight"
            >
              {lessonUrl}
            </AppText>
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderFileContent = () => {
    if (!lessonFile) return null;

    const fileName = lessonFile.split("/").pop();
    const fileType = lessonFile.split(".").pop()?.toLowerCase();

    switch (fileType) {
      case "jpg":
      case "jpeg":
      case "png":
        return (
          <TouchableOpacity onPress={() => showImage(lessonFile)}>
            <Card className="shadow-none rounded-xl max-w-3xl flex-row items-center gap-2.5 mt-2.5 dark:bg-neutral-800/50">
              <View className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                <Icon
                  className="text-teal-600 dark:text-teal-400 h-10 w-10"
                  name="ImageIcon"
                />
              </View>
              <View className="flex-1">
                <AppText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  className="text-neutral-900 dark:text-neutral-100"
                  style={{ flexShrink: 1 }}
                >
                  {fileName}
                </AppText>
              </View>
            </Card>
          </TouchableOpacity>
        );
      case "mp4":
        return (
          <>
            <Pressable onPress={() => setShowVideo(!showVideo)}>
              <Card className="shadow-none rounded-xl max-w-3xl flex-row items-center gap-2.5 mt-2.5 dark:bg-neutral-800/50">
                <View className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                  <Icon
                    className="text-purple-600 dark:text-purple-400 h-10 w-10"
                    name="PlayIcon"
                  />
                </View>
                <View className="flex-1">
                  <AppText
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    className="text-neutral-900 dark:text-neutral-100"
                  >
                    {fileName}
                  </AppText>
                </View>
              </Card>
            </Pressable>
            {showVideo && (
              <View className="w-full max-w-3xl mx-auto mt-2.5">
                <VideoView
                  style={styles.video}
                  player={player}
                  allowsFullscreen
                  allowsPictureInPicture
                  contentFit="contain"
                />
              </View>
            )}
          </>
        );

      case "pdf":
        return (
          <Pressable
            onPress={async () => {
              await WebBrowser.openBrowserAsync(lessonFile);
            }}
          >
            <Card className="shadow-none rounded-xl max-w-3xl flex-row items-center gap-2.5 mt-2.5 dark:bg-neutral-800/50">
              <View className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                <Icon
                  className="text-red-600 dark:text-red-400 h-10 w-10"
                  name="FileIcon"
                />
              </View>
              <View className="flex-1">
                <AppText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  className="text-neutral-900 dark:text-neutral-100"
                >
                  {fileName}
                </AppText>
              </View>
            </Card>
          </Pressable>
        );

      default:
        return null;
    }
  };

  return (
    <View className="gap-2">
      {renderUrlLink()}
      {renderFileContent()}
    </View>
  );
};

const { width: screenWidth } = Dimensions.get("window");

const styles = StyleSheet.create({
  video: {
    height: Math.min(screenWidth * 0.6, 430), // Responsive height with max limit
    aspectRatio: 16 / 9, // Standard video aspect ratio
    maxWidth: screenWidth * 0.9, // Responsive width with max limit
    marginHorizontal: "auto",
  },
});
export default FileRenderer;
