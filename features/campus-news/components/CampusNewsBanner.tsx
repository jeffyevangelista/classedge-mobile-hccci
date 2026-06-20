import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, type LayoutChangeEvent, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel from "react-native-reanimated-carousel";
import type { FacebookPost } from "../campus-news.types";
import { CampusNewsCard } from "./CampusNewsCard";

interface Props {
  posts: FacebookPost[];
}

const CARD_HEIGHT = 220;
const CARD_GAP = 12;
const AUTO_PLAY_INTERVAL = 5000;
const SCROLL_DURATION = 600;
const RESUME_DELAY_MS = 3000;

export function CampusNewsBanner({ posts }: Props) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isAutoPlayActive, setIsAutoPlayActive] = useState(true);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revertModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 0 = autoplay (fade), 1 = user-driven (slide). Worklet reads this on
  // every frame so we can swap animations without remounting the carousel.
  const isUserDragging = useSharedValue(0);

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
      if (revertModeTimerRef.current) clearTimeout(revertModeTimerRef.current);
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

  const handleTouchStart = () => {
    if (revertModeTimerRef.current) {
      clearTimeout(revertModeTimerRef.current);
      revertModeTimerRef.current = null;
    }
    isUserDragging.value = 1;
  };

  const handleTouchRelease = () => {
    if (revertModeTimerRef.current) clearTimeout(revertModeTimerRef.current);
    // Hold slide mode through the snap animation so transform/opacity
    // don't jump mid-settle.
    revertModeTimerRef.current = setTimeout(() => {
      isUserDragging.value = 0;
    }, SCROLL_DURATION + 80);
  };

  const carouselAnimation = (value: number) => {
    "worklet";
    const clamped = Math.max(-1, Math.min(1, value));
    if (isUserDragging.value === 1) {
      return {
        transform: [{ translateX: clamped * width }],
        opacity: 1,
        zIndex: 0,
      };
    }
    const abs = Math.abs(clamped);
    // Smoothstep S-curve — gentler ramp at the endpoints than linear.
    const smooth = abs * abs * (3 - 2 * abs);
    return {
      transform: [{ translateX: 0 }, { scale: 1 - 0.04 * smooth }],
      opacity: 1 - smooth,
      zIndex: abs < 0.5 ? 1 : 0,
    };
  };

  return (
    <View
      onLayout={onLayout}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchRelease}
      onTouchCancel={handleTouchRelease}
      // Pull the carousel outward by the per-item inset so the card's
      // visible left edge aligns with the section header (and other home
      // sections) while still preserving the gap between cards on swipe.
      style={{ marginHorizontal: -CARD_GAP / 2 }}
    >
      {width > 0 && (
        <Carousel
          data={posts}
          width={width}
          height={CARD_HEIGHT}
          loop={!isSingle}
          autoPlay={shouldAutoPlay}
          autoPlayInterval={AUTO_PLAY_INTERVAL}
          scrollAnimationDuration={SCROLL_DURATION}
          customAnimation={carouselAnimation}
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
