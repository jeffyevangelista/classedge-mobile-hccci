import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import {
  MaterialTabBar,
  type MaterialTabBarProps,
  Tabs,
  useHeaderMeasurements,
} from "react-native-collapsible-tab-view";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import { useClassroom } from "@/features/classroom/classroom.hooks";
import ClassroomActivitiyList from "@/features/classroom/components/ClassroomActivitiyList";
import CourseworkList from "@/features/classroom/components/CourseworkList";
import {
  type CreateAction,
  CreateActionSheet,
} from "@/features/classroom/components/CreateActionSheet";
import LessonList from "@/features/classroom/components/LessonList";
import { useSafeBottomInset } from "@/hooks/useSafeBottomInset";

const HERO_RATIO = 0.28; // matches student CourseScreen.tsx:38
const NAV_HEIGHT = 56;

type HeroProps = {
  heroHeight: number;
  statusBarInset: number;
  isLoading: boolean;
  subjectName: string;
  subtitle: string;
  subjectPhoto: string | undefined;
  classroomId: string;
  foregroundColor: string;
  surfaceColor: string;
  borderColor: string;
  glassBg: string;
  solidBg: string;
};

const Hero = ({
  heroHeight,
  statusBarInset,
  isLoading,
  subjectName,
  subtitle,
  subjectPhoto,
  classroomId,
  foregroundColor,
  surfaceColor,
  borderColor,
  glassBg,
  solidBg,
}: HeroProps) => {
  const router = useRouter();
  const { top: headerTop } = useHeaderMeasurements();

  // Hero height already includes the status-bar inset so the photo extends
  // edge-to-edge (under the status bar) in both states. `navBandHeight` is
  // the slice that stays visible when collapsed — also includes the inset
  // so the surface band fills behind the system clock/battery icons.
  const navBandHeight = NAV_HEIGHT + statusBarInset;
  const distance = heroHeight - navBandHeight;

  // Pin UI elements at on-screen y = statusBarInset (= just below the system
  // status bar text/icons). Driven via `transform: translateY` (GPU, no
  // layout pass) instead of `top` (triggers layout each frame — Android
  // gets visibly janky at 60fps with multiple `top` animations).
  const pinnedTopStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          headerTop.value,
          [-distance, 0],
          [statusBarInset + distance, statusBarInset],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Expanded title (bottom-left, white) — fades out as we approach collapse.
  const expandedTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      headerTop.value,
      [-distance, -distance + 40],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Collapsed surface band — anchored at on-screen y = 0 (behind the status
  // bar) so its solid color fills the system inset area when collapsed.
  // Opacity ramps over the full scroll distance so the band fades in
  // simultaneously with the photo blur, rather than snapping in at the end.
  const collapsedSurfaceStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          headerTop.value,
          [-distance, 0],
          [distance, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
    opacity: interpolate(
      headerTop.value,
      [-distance, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Collapsed title — pinned below the status bar via translateY (same
  // cancellation trick as the buttons).
  const collapsedTitleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          headerTop.value,
          [-distance, 0],
          [statusBarInset + distance, statusBarInset],
          Extrapolation.CLAMP,
        ),
      },
    ],
    opacity: interpolate(
      headerTop.value,
      [-distance + 20, -distance],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Glass button backgrounds (expanded) fade out.
  const glassBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      headerTop.value,
      [-distance + 40, -distance],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Solid button backgrounds (collapsed) fade in.
  const solidBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      headerTop.value,
      [-distance + 40, -distance],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Photo blur — fixed intensity wrapped in a hardware-textured Animated.View
  // whose opacity fades in. Avoids the per-frame intensity rasterization
  // that makes Android janky; `renderToHardwareTextureAndroid` forces the
  // wrapper into its own GPU layer so opacity composites the BlurView
  // correctly on Android (parent alpha alone doesn't reliably apply to
  // Dimezis-backed BlurView).
  const blurOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      headerTop.value,
      [-distance, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={{ height: heroHeight }}>
      {/* Photo — fills the whole Hero, edge-to-edge incl. behind the status bar. */}
      {isLoading ? (
        <Skeleton style={StyleSheet.absoluteFill} />
      ) : (
        <AttachmentImage
          path={subjectPhoto}
          fallback={
            <Image
              source={require("@/assets/placeholder/bg-placeholder.png")}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          }
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
        />
      )}
      <Animated.View
        style={[StyleSheet.absoluteFill, blurOpacityStyle]}
        pointerEvents="none"
        renderToHardwareTextureAndroid
      >
        <BlurView
          intensity={35}
          tint="default"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
        start={{ x: 0, y: 0.35 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Expanded title — anchored above the eventual collapsed nav band. */}
      <Animated.View
        style={[
          styles.heroText,
          { bottom: navBandHeight + 14 },
          expandedTitleStyle,
        ]}
      >
        <AppText
          weight="semibold"
          className="text-2xl text-white"
          numberOfLines={2}
        >
          {subjectName}
        </AppText>
        {subtitle ? (
          <AppText className="text-xs text-white/90 mt-1" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </Animated.View>

      {/* Collapsed surface band — full nav-band height, includes status-bar inset. */}
      <Animated.View
        style={[
          styles.collapsedBand,
          {
            backgroundColor: surfaceColor,
            borderBottomColor: borderColor,
            height: navBandHeight,
          },
          collapsedSurfaceStyle,
        ]}
        pointerEvents="none"
      />

      {/* Centered collapsed title — pinned below the status bar. */}
      <Animated.View
        style={[styles.collapsedTitleWrap, collapsedTitleStyle]}
        pointerEvents="none"
      >
        <AppText
          weight="semibold"
          className="text-base text-foreground"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {subjectName}
        </AppText>
      </Animated.View>

      {/* Buttons row — pinned below the status bar. Backgrounds cross-fade. */}
      <Animated.View style={[styles.navRow, pinnedTopStyle]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.navButton}
        >
          <Animated.View
            style={[
              styles.navButtonBgGlass,
              { backgroundColor: glassBg },
              glassBgStyle,
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.navButtonBgSolid,
              { backgroundColor: solidBg },
              solidBgStyle,
            ]}
            pointerEvents="none"
          />
          <Icon name="ArrowLeftIcon" size={22} color={foregroundColor} />
        </Pressable>
        <Pressable
          onPress={() =>
            router.push(`/(main)/classroom/${classroomId}/course-details`)
          }
          accessibilityRole="button"
          accessibilityLabel="Open course details"
          style={styles.navButton}
        >
          <Animated.View
            style={[
              styles.navButtonBgGlass,
              { backgroundColor: glassBg },
              glassBgStyle,
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.navButtonBgSolid,
              { backgroundColor: solidBg },
              solidBgStyle,
            ]}
            pointerEvents="none"
          />
          <Icon name="InfoIcon" size={22} color={foregroundColor} />
        </Pressable>
      </Animated.View>
    </View>
  );
};

const ClassroomScreen = () => {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Photo extends through the status bar — add the inset to the visible
  // hero so the system clock/battery icons sit on top of the photo.
  const heroHeight = Math.round(screenHeight * HERO_RATIO) + insets.top;

  const surfaceColor = useThemeColor("surface");
  const foregroundColor = useThemeColor("foreground");
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");
  const borderColor = useThemeColor("border");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  // Glass = translucent button background visible on the photo (expanded state).
  // Solid (collapsed) = transparent — icons sit directly on the nav surface
  // with no chip, matching iOS / Material 3 nav convention.
  const glassBg = isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.85)";
  const solidBg = "transparent";

  const { data, isLoading } = useClassroom(classroomId as string);
  const course = data?.[0];
  const subjectName = course?.subjectName ?? "";
  const subjectType = course?.subjectType ?? "";
  const roomNumber = course?.roomNumber ?? "";
  const subjectPhoto = course?.subjectPhoto ?? undefined;

  const subtitleParts = [
    subjectType,
    roomNumber ? `Room ${roomNumber}` : "",
  ].filter(Boolean);
  const subtitle = subtitleParts.join(" · ");

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  // Initial value MUST match the first <Tabs.Tab name=...> below.
  const [focusedTab, setFocusedTab] = useState<string>("materials");
  const safeBottom = useSafeBottomInset();

  const createActions = useMemo<CreateAction[]>(
    () => [
      {
        key: "activity",
        icon: "PencilLineIcon",
        label: "In-class assessment",
        description: "You'll grade students manually after class.",
        onPress: () =>
          router.push(
            `/(main)/classroom/${classroomId as string}/create-activity`,
          ),
      },
    ],
    [classroomId, router],
  );

  const showFab = focusedTab === "in-class";

  const renderHeader = () => (
    <Hero
      heroHeight={heroHeight}
      statusBarInset={insets.top}
      isLoading={isLoading}
      subjectName={subjectName}
      subtitle={subtitle}
      subjectPhoto={subjectPhoto}
      classroomId={classroomId as string}
      foregroundColor={foregroundColor}
      surfaceColor={surfaceColor}
      borderColor={borderColor}
      glassBg={glassBg}
      solidBg={solidBg}
    />
  );

  const renderTabBar = (props: MaterialTabBarProps<string>) => (
    <MaterialTabBar
      {...props}
      indicatorStyle={{ backgroundColor: accentColor }}
      activeColor={accentColor}
      inactiveColor={mutedColor}
      labelStyle={{ fontFamily: "Poppins-Medium", textTransform: "none" }}
      style={{
        backgroundColor: surfaceColor,
        elevation: 0,
        shadowOpacity: 0,
      }}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <Tabs.Container
        renderHeader={renderHeader}
        headerHeight={heroHeight}
        minHeaderHeight={NAV_HEIGHT + insets.top}
        renderTabBar={renderTabBar}
        onTabChange={({ tabName }) => setFocusedTab(String(tabName))}
      >
        <Tabs.Tab name="materials" label="Materials">
          <LessonList ListComponent={Tabs.FlatList as never} />
        </Tabs.Tab>
        <Tabs.Tab name="assessments" label="Assessments">
          <CourseworkList ListComponent={Tabs.FlatList as never} />
        </Tabs.Tab>
        <Tabs.Tab name="in-class" label="In-class">
          <ClassroomActivitiyList ListComponent={Tabs.FlatList as never} />
        </Tabs.Tab>
      </Tabs.Container>

      {showFab ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
          style={[styles.fab, { bottom: safeBottom + 20 }]}
        >
          <Pressable
            onPress={() => setCreateSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Create new"
            style={[styles.fabButton, { backgroundColor: accentColor }]}
          >
            <Icon name="PlusIcon" size={26} color="#ffffff" />
          </Pressable>
        </Animated.View>
      ) : null}

      <CreateActionSheet
        isOpen={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        actions={createActions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  collapsedBand: {
    position: "absolute",
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collapsedTitleWrap: {
    position: "absolute",
    left: 64,
    right: 64,
    height: NAV_HEIGHT,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  navRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: NAV_HEIGHT,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  navButtonBgGlass: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
  },
  navButtonBgSolid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
  },
  heroText: {
    position: "absolute",
    left: 18,
    right: 18,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabButton: {
    flex: 1,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ClassroomScreen;
