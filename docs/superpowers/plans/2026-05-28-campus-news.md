# Campus News Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on staging/committing:** The user (`jeffthedev`) owns staging and commits in this repo. Do NOT run `git add` or `git commit` in any step. Each task ends at a clean checkpoint — leave the working tree dirty.

**Goal:** Add an auto-playing Campus News hero banner on HomeScreen, surfacing recent Facebook posts from the school via `/facebook-posts/`. Tap → opens the post in an in-app browser.

**Architecture:** New REST-only feature folder `features/campus-news/` (no PowerSync). React Query for caching with short TTLs (FB CDN URLs expire). `react-native-reanimated-carousel` powers the auto-play with pause-on-touch + reduced-motion respect. A self-managing `<CampusNewsSection>` owns its visibility — HomeScreen drops it in and forgets about it.

**Tech Stack:** Expo SDK 54, React Native, `@tanstack/react-query` (already configured), `react-native-reanimated-carousel` (new dep), `expo-linear-gradient` (already installed), `expo-web-browser` (already installed), `expo-image` (already wrapped as `@/components/Image`), `dayjs` with `relativeTime` plugin (already installed).

---

## File Structure

**New files:**

- `features/campus-news/campus-news.types.ts` — `FacebookPost`, `FacebookPostsResponse`, `resolvePostImage()`
- `features/campus-news/campus-news.apis.ts` — `getFacebookPosts()` REST call
- `features/campus-news/campus-news.hooks.ts` — `useFacebookPosts()` react-query wrapper
- `features/campus-news/components/CampusNewsCard.tsx` — single hero card with image + gradient + title
- `features/campus-news/components/CampusNewsBannerSkeleton.tsx` — loading state
- `features/campus-news/components/CampusNewsBanner.tsx` — the carousel itself
- `features/campus-news/components/CampusNewsSection.tsx` — public entry: header + banner + state management

**Modified files:**

- `package.json` — add `react-native-reanimated-carousel` dependency
- `screens/main/HomeScreen.tsx` — render `<CampusNewsSection />` and opportunistic cleanup

---

## Task 1: Install carousel dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the carousel library**

Run from project root: `pnpm add react-native-reanimated-carousel`

Expected: package added to `dependencies` in `package.json`; lockfile updated; install completes without errors. This library has peer-deps on `react-native-reanimated` and `react-native-gesture-handler` — both already installed.

- [ ] **Step 2: Verify install**

Run: `pnpm typecheck`
Expected: exit 0. (Pre-existing errors in `screens/main/announcement/AnnouncementDetailsScreen.tsx` are fine — they aren't from this task.)

- [ ] **Step 3: Commit checkpoint** — leave dirty; user commits.

---

## Task 2: Create types and image helper

**Files:**
- Create: `features/campus-news/campus-news.types.ts`

- [ ] **Step 1: Create the types file**

Write `features/campus-news/campus-news.types.ts`:

```ts
export type FacebookPost = {
  message: string;
  createdTime: string;
  postedBy: string;
  profilePictureUrl: string;
  permalinkUrl: string;
  imageUrl: string;
};

export type FacebookPostsResponse = {
  posts: FacebookPost[];
};

/**
 * Resolve a post's imageUrl to a usable absolute URL, or return null when
 * the API returned a placeholder/relative path (e.g. "/static/...").
 * Callers should substitute a local placeholder when this returns null.
 */
export function resolvePostImage(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

/**
 * Pick the first non-empty line of a post message to use as a visible title.
 * Falls back to the whole message if there are no line breaks.
 */
export function postTitle(message: string): string {
  if (!message) return "";
  const lines = message.split("\n").map((line) => line.trim());
  return lines.find((line) => line.length > 0) ?? message;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit checkpoint.**

---

## Task 3: Create REST API client

**Files:**
- Create: `features/campus-news/campus-news.apis.ts`

- [ ] **Step 1: Create the API file**

Write `features/campus-news/campus-news.apis.ts`:

```ts
import api from "@/lib/axios";
import type { FacebookPostsResponse } from "./campus-news.types";

export const getFacebookPosts = async (): Promise<FacebookPostsResponse> => {
  return (await api.get<FacebookPostsResponse>("/facebook-posts/")).data;
};
```

The `@/lib/axios` default export is the configured axios instance (same one used by `features/calendar/calendar.apis.ts`).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit checkpoint.**

---

## Task 4: Create the react-query hook

**Files:**
- Create: `features/campus-news/campus-news.hooks.ts`

- [ ] **Step 1: Create the hook file**

Write `features/campus-news/campus-news.hooks.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { getFacebookPosts } from "./campus-news.apis";

/**
 * Fetches campus news (Facebook page posts) for the HomeScreen banner.
 *
 * Caching: 30-minute staleTime so most HomeScreen opens reuse cached data.
 * 1-hour gcTime so we drop the cache well before FB CDN image URLs expire
 * (their `oe=` query param expiry is typically ~6h from request time).
 * HomeScreen's pull-to-refresh invalidates all stale queries, which picks
 * this up automatically — no per-feature wiring needed.
 */
export const useFacebookPosts = () => {
  return useQuery({
    queryKey: ["facebook-posts"],
    queryFn: getFacebookPosts,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit checkpoint.**

---

## Task 5: Create CampusNewsCard component

**Files:**
- Create: `features/campus-news/components/CampusNewsCard.tsx`

- [ ] **Step 1: Create the card component**

Write `features/campus-news/components/CampusNewsCard.tsx`:

```tsx
import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Image from "@/components/Image";
import { AppText } from "@/components/AppText";
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
    WebBrowser.openBrowserAsync(post.permalinkUrl);
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
      <Image
        source={resolved ? { uri: resolved } : placeholder}
        placeholder={placeholder}
        className="w-full h-full"
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        locations={[0.4, 1]}
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
          numberOfLines={2}
        >
          {title}
        </AppText>
        <AppText className="text-xs text-white/70 mt-0.5">{timeLabel}</AppText>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: exit non-zero is fine (pre-existing diagnostics across the codebase). No new findings in this file.

- [ ] **Step 4: Commit checkpoint.**

---

## Task 6: Create CampusNewsBannerSkeleton component

**Files:**
- Create: `features/campus-news/components/CampusNewsBannerSkeleton.tsx`

- [ ] **Step 1: Create the skeleton**

Write `features/campus-news/components/CampusNewsBannerSkeleton.tsx`:

```tsx
import { View } from "react-native";
import { Skeleton } from "heroui-native";

export function CampusNewsBannerSkeleton() {
  return (
    <View>
      <Skeleton className="rounded-2xl w-full" style={{ height: 220 }} />
      <View className="flex-row justify-center items-center gap-1.5 mt-3">
        <View className="w-1.5 h-1.5 rounded-full bg-muted" />
        <View className="w-1.5 h-1.5 rounded-full bg-muted" />
        <View className="w-1.5 h-1.5 rounded-full bg-muted" />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit checkpoint.**

---

## Task 7: Create CampusNewsBanner component (the carousel)

**Files:**
- Create: `features/campus-news/components/CampusNewsBanner.tsx`

- [ ] **Step 1: Create the banner component**

Write `features/campus-news/components/CampusNewsBanner.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
  View,
} from "react-native";
import Carousel, {
  type ICarouselInstance,
} from "react-native-reanimated-carousel";
import { CampusNewsCard } from "./CampusNewsCard";
import type { FacebookPost } from "../campus-news.types";

interface Props {
  posts: FacebookPost[];
}

const CARD_HEIGHT = 220;
const AUTO_PLAY_INTERVAL = 5000;
const SCROLL_DURATION = 600;
const RESUME_DELAY_MS = 3000;

export function CampusNewsBanner({ posts }: Props) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const carouselRef = useRef<ICarouselInstance>(null);
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
  const shouldAutoPlay = !isSingle && !reduceMotion;

  const handleScrollBegin = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    carouselRef.current?.pause?.();
  };

  const handleScrollEnd = () => {
    if (!shouldAutoPlay) return;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      carouselRef.current?.start?.();
    }, RESUME_DELAY_MS);
  };

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Carousel
          ref={carouselRef}
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
          renderItem={({ item }) => <CampusNewsCard post={item} />}
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new findings in this file.

- [ ] **Step 4: Commit checkpoint.**

---

## Task 8: Create CampusNewsSection (public entry)

**Files:**
- Create: `features/campus-news/components/CampusNewsSection.tsx`

- [ ] **Step 1: Create the section component**

Write `features/campus-news/components/CampusNewsSection.tsx`:

```tsx
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { getApiErrorMessage } from "@/lib/api-error";
import { useFacebookPosts } from "../campus-news.hooks";
import { CampusNewsBanner } from "./CampusNewsBanner";
import { CampusNewsBannerSkeleton } from "./CampusNewsBannerSkeleton";

export default function CampusNewsSection() {
  const { data, isLoading, isError, error, refetch } = useFacebookPosts();

  if (isLoading) {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader />
        <CampusNewsBannerSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader />
        <ErrorComponent
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  const posts = data?.posts ?? [];
  if (posts.length === 0) return null;

  return (
    <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
      <SectionHeader />
      <CampusNewsBanner posts={posts} />
    </View>
  );
}

const SectionHeader = () => (
  <AppText weight="semibold" className="text-lg mb-3">
    Campus News
  </AppText>
);
```

Note on `ErrorComponent` prop name: this file uses `onRetry`, matching the existing usage in `features/announcements/components/AnnouncementList.tsx:28` (`onRetry={refresh}`). If your local copy of `ErrorComponent` uses `onRefetch` instead, use that name — match the actual prop signature in `components/ErrorComponent.tsx`.

- [ ] **Step 2: Verify the ErrorComponent prop name**

Run: `grep -n "interface\|type\|onRetry\|onRefetch" components/ErrorComponent.tsx | head -10`

Expected: shows which prop the component uses. If `onRetry`, the code above is correct. If `onRefetch`, change `onRetry={() => refetch()}` to `onRefetch={() => refetch()}`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: no new findings.

- [ ] **Step 5: Commit checkpoint.**

---

## Task 9: Wire into HomeScreen + cleanup

**Files:**
- Modify: `screens/main/HomeScreen.tsx`

- [ ] **Step 1: Apply the full edit**

Replace the entire contents of `screens/main/HomeScreen.tsx` with:

```tsx
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import CampusNewsSection from "@/features/campus-news/components/CampusNewsSection";
import { useCallback, useState } from "react";
import { View } from "react-native";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";
import { RefreshIndicator } from "@/components/RefreshIndicator";

const HomeScreen = () => {
  const { authUser } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ stale: true });
    setRefreshing(false);
  }, []);

  const isStudent = authUser?.role === "Student";

  return (
    <Screen>
      <ScreenScrollView
        className="w-full"
        scrollIndicatorInsets={{ right: 1 }}
        refreshControl={
          <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isStudent && (
          <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
            <SectionHeader title="My Schedule" />
            <ScheduleComponent />
          </View>
        )}

        <CampusNewsSection />

        <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
          <SectionHeader title="Announcements" />
        </View>
        <AnnouncementList />
      </ScreenScrollView>
    </Screen>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <AppText weight="semibold" className="text-lg mb-3">
    {title}
  </AppText>
);

export default HomeScreen;
```

The changes vs. the previous file:

- Removed `ScrollView` from the `react-native` import (only `View` remains).
- Removed `import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"` (no longer used).
- Added `import { ScreenScrollView } from "@/components/ScreenScrollView"`.
- Added `import CampusNewsSection from "@/features/campus-news/components/CampusNewsSection"`.
- Replaced `<ScrollView ... style={{ marginBottom: safeBottom }} ...>` with `<ScreenScrollView ...>`.
- Removed the local `const safeBottom = useScrollBottomInset();` line.
- Inserted `<CampusNewsSection />` between the Schedule block and the Announcements block.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new findings in `screens/main/HomeScreen.tsx`.

- [ ] **Step 4: Manual sanity boot (optional but recommended)**

Reload the dev client (shake → reload, or restart Metro with `pnpm start` → `r`). Open HomeScreen and confirm:

- Banner shows a skeleton while loading.
- After ~1s, hero card appears with a real campus photo (or placeholder if the API returned a relative `imageUrl`).
- Carousel auto-advances every ~5s.
- Dragging pauses; ~3s after release it resumes.
- Tapping a card opens the in-app browser to the Facebook post.
- Pull-to-refresh on HomeScreen refetches the banner alongside Schedule + Announcements.
- Non-student account: Campus News is the first section (no Schedule above).
- Empty case (if the API returns no posts): section is gone entirely — no orphan header.

- [ ] **Step 5: Commit checkpoint.**

---

## Self-review

**Spec coverage:**

- "Feature folder `features/campus-news/`" → Tasks 2, 3, 4, 5, 6, 7, 8 ✓
- "REST via `lib/axios.ts`" → Task 3 ✓
- "react-query with 30-min staleTime, 1-hour gcTime" → Task 4 ✓
- "`resolvePostImage()` for relative paths" → Task 2 ✓
- "Card UI with hero image + gradient + title + relative time" → Task 5 ✓
- "Tap → `expo-web-browser.openBrowserAsync(permalinkUrl)`" → Task 5 ✓
- "No `postedBy` per card" → Task 5 (absent) ✓
- "Auto-play 5s, pause on touch, resume after 3s, loop" → Task 7 ✓
- "Reduce-motion respected" → Task 7 ✓
- "Pagination dots" → Task 7 ✓
- "Empty (no posts) → render nothing" → Tasks 7 + 8 ✓
- "Single post → no dots, no auto-play, no loop" → Task 7 ✓
- "`CampusNewsSection` self-manages visibility incl. header" → Task 8 ✓
- "Loading / error / empty states" → Task 8 ✓
- "HomeScreen integration + opportunistic cleanup" → Task 9 ✓
- "New `react-native-reanimated-carousel` dep" → Task 1 ✓

**Placeholder scan:** No TBD/TODO/vague handwaving. Every step shows full code or exact commands.

**Type/name consistency:**

- `FacebookPost`, `FacebookPostsResponse` defined in Task 2, consumed identically in Tasks 3, 4, 5, 7.
- `resolvePostImage`, `postTitle` defined in Task 2, consumed in Task 5.
- `useFacebookPosts` defined in Task 4, consumed in Task 8.
- `CampusNewsCard`, `CampusNewsBanner`, `CampusNewsBannerSkeleton`, `CampusNewsSection` — all referenced by their definition name across tasks.
- Task 7's carousel uses `posts` prop; Task 8 passes `posts={posts}`. Consistent.
- Task 8 uses `CampusNewsSection` as a default export and Task 9 imports it as a default. Consistent.

**One known integration check is built into Task 8 Step 2** — verifies `ErrorComponent`'s prop name (`onRetry` vs `onRefetch`) before relying on it. This is the only place where the plan's correctness depends on a prop signature outside the new files.
