import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import {
  type FacebookPost,
  postTitle,
  resolvePostImage,
} from "../campus-news.types";

dayjs.extend(relativeTime);

const placeholder = require("@/assets/placeholder/bg-placeholder.png");

interface Props {
  post: FacebookPost;
}

export function CampusNewsCard({ post }: Props) {
  const resolved = resolvePostImage(post.imageUrl);
  const title = postTitle(post.message);
  const timeLabel = dayjs(post.createdTime).fromNow();

  const onPress = () => {
    void WebBrowser.openBrowserAsync(post.permalinkUrl);
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${timeLabel}`}
      accessibilityHint="Opens the full post on Facebook"
      className="rounded-2xl overflow-hidden"
      style={{ height: 220 }}
    >
      {resolved ? (
        <>
          <Image
            source={{ uri: resolved }}
            contentFit="cover"
            blurRadius={24}
            accessible={false}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <Image
            source={{ uri: resolved }}
            placeholder={placeholder}
            contentFit="contain"
            transition={200}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
        </>
      ) : (
        <Image
          source={placeholder}
          contentFit="cover"
          className="w-full h-full"
        />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.88)"]}
        locations={[0.5, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
        }}
      />
      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        className="p-4"
      >
        <AppText
          weight="semibold"
          className="text-base text-white"
          style={{ fontFamily: "Poppins-SemiBold" }}
          numberOfLines={2}
        >
          {title}
        </AppText>
        <AppText
          className="text-xs text-white/70 mt-0.5"
          style={{ fontFamily: "Poppins-Regular" }}
        >
          {timeLabel}
        </AppText>
      </View>
    </Pressable>
  );
}
