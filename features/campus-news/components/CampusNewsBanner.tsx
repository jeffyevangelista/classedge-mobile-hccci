import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, type LayoutChangeEvent, View } from "react-native";
import Carousel from "react-native-reanimated-carousel";
import type { FacebookPost } from "../campus-news.types";
import { CampusNewsCard } from "./CampusNewsCard";

interface Props {
  posts: FacebookPost[];
}

const CARD_HEIGHT = 220;
const CARD_GAP = 12;
const AUTO_PLAY_INTERVAL = 5000;
const SCROLL_DURATION = 400;
const RESUME_DELAY_MS = 3000;

export function CampusNewsBanner({ posts }: Props) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isAutoPlayActive, setIsAutoPlayActive] = useState(true);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        if (mounted) setReduceMotion(value);
      },
    );

    return () => {
      mounted = false;
      sub.remove();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  if (posts.length === 0) return null;

  const isSingle = posts.length === 1;
  const shouldAutoPlay = !isSingle && !reduceMotion && isAutoPlayActive;

  const handleScrollBegin = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    setIsAutoPlayActive(false);
  };

  const handleScrollEnd = () => {
    if (isSingle || reduceMotion) return;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setIsAutoPlayActive(true);
    }, RESUME_DELAY_MS);
  };

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Carousel
          data={posts}
          width={width}
          height={CARD_HEIGHT}
          loop={!isSingle}
          autoPlay={shouldAutoPlay}
          autoPlayInterval={AUTO_PLAY_INTERVAL}
          scrollAnimationDuration={SCROLL_DURATION}
          onSnapToItem={setActiveIndex}
          onScrollStart={handleScrollBegin}
          onScrollEnd={handleScrollEnd}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: CARD_GAP / 2 }}>
              <CampusNewsCard post={item} />
            </View>
          )}
        />
      )}

      {!isSingle && (
        <View
          className="flex-row justify-center items-center gap-1.5 mt-3"
          importantForAccessibility="no"
        >
          {posts.map((post, index) => {
            const isActive = index === activeIndex;
            return (
              <View
                key={post.permalinkUrl}
                className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? "bg-accent" : "bg-muted"
                }`}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
