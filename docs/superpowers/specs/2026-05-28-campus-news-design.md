# Campus News Banner

**Date:** 2026-05-28
**Status:** Design — pending implementation plan

## Goal

Add a Campus News auto-playing hero banner to HomeScreen, surfacing recent posts from the school's public Facebook page via the existing `/facebook-posts/` REST endpoint. Visible to all roles. Tapping a card opens the post on Facebook in an in-app browser.

## Non-goals

- No detail screen, modal, or bottom sheet. Tap = open `permalinkUrl` in `expo-web-browser`.
- No "See all" link. The carousel shows whatever the endpoint returns (no separate index/feed screen).
- No interactions (like, comment, share, save). Pure read-only banner.
- No offline storage. The endpoint isn't PowerSync-backed; cached via react-query only.
- No push notifications for new posts.

## API

Endpoint: `GET /facebook-posts/` (via existing `lib/axios.ts`).

Response shape:

```ts
type FacebookPost = {
  message: string;        // full post body (FB-style stylized Unicode preserved)
  createdTime: string;    // ISO 8601
  postedBy: string;       // always "Holy Child Central Colleges, Inc." — single school
  profilePictureUrl: string;
  permalinkUrl: string;   // unique key (no `id` field returned)
  imageUrl: string;       // absolute https URL, OR relative path like `/static/assets/img/HCCCI-logo.png`
};

type FacebookPostsResponse = { posts: FacebookPost[] };
```

API caveats:

1. **No `id` field.** `permalinkUrl` is the unique key (used as React `key`).
2. **No `title` / `body` split.** Whole `message` is one chunk; the FB-style stylized Unicode (e.g. `𝐄𝐢𝐝 𝐚𝐥-𝐀𝐝𝐡𝐚`) renders fine in RN Text. UI uses the first non-empty line as the visible title.
3. **`imageUrl` may be a relative path** (typically `/static/assets/img/HCCCI-logo.png` when the post has no hero photo). Treat any non-`http(s)` URL as "no real image" and substitute a local placeholder.
4. **FB CDN URLs expire.** The signed query params (`oh=...&oe=...`) embed a Unix expiry timestamp, typically ~6 hours from request time. Caching strategy below accounts for this.
5. **`postedBy` is constant** (always the school's page). Not shown per-card.

## Architecture

New feature folder mirroring the existing `features/calendar/` (REST-only, no PowerSync):

```
features/campus-news/
  campus-news.types.ts            FacebookPost, FacebookPostsResponse, resolvePostImage()
  campus-news.apis.ts             getFacebookPosts() → axios GET /facebook-posts/
  campus-news.hooks.ts            useFacebookPosts() — react-query wrapper
  components/
    CampusNewsSection.tsx         self-managing section (header + banner); HomeScreen consumes this
    CampusNewsBanner.tsx          the auto-playing carousel (used by Section)
    CampusNewsCard.tsx            single hero card
    CampusNewsBannerSkeleton.tsx  loading state
```

`CampusNewsSection` owns the section header and decides whether to render anything at all — when `posts.length === 0`, it returns `null` so the header doesn't appear alone. This keeps HomeScreen free of campus-news-specific visibility logic.

Touched outside the new folder:

- `screens/main/HomeScreen.tsx` — render `<CampusNewsBanner />` between Schedule and Announcements; opportunistic cleanup (see "HomeScreen integration").
- `package.json` — add `react-native-reanimated-carousel`.

## Library choice

`react-native-reanimated-carousel` (~5k stars, actively maintained). Provides:

- Auto-play with interval, loop, pause-on-touch out of the box
- Built on `react-native-reanimated` and `react-native-gesture-handler` (both already installed)

Trade considered: rolling our own with FlashList-horizontal + `setInterval` would be ~150 lines of carousel logic (advance, pause, resume, loop, dots, reduced-motion). Not worth it.

## Data flow

### `campus-news.types.ts`

```ts
export type FacebookPost = {
  message: string;
  createdTime: string;
  postedBy: string;
  profilePictureUrl: string;
  permalinkUrl: string;
  imageUrl: string;
};

export type FacebookPostsResponse = { posts: FacebookPost[] };

/**
 * FB CDN absolute URL → use as-is. Relative path (e.g. `/static/...`) →
 * return null so the caller substitutes a local placeholder. The school-logo
 * fallback path the API sometimes returns is not meant as a hero image.
 */
export function resolvePostImage(url: string): string | null {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}
```

### `campus-news.apis.ts`

```ts
import api from "@/lib/axios";
import type { FacebookPostsResponse } from "./campus-news.types";

export const getFacebookPosts = async () => {
  return (await api.get<FacebookPostsResponse>("/facebook-posts/")).data;
};
```

### `campus-news.hooks.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { getFacebookPosts } from "./campus-news.apis";

export const useFacebookPosts = () => {
  return useQuery({
    queryKey: ["facebook-posts"],
    queryFn: getFacebookPosts,
    staleTime: 1000 * 60 * 30,  // 30 minutes
    gcTime: 1000 * 60 * 60,     // 1 hour — drop cache before FB URLs expire (~6h)
  });
};
```

### Refresh integration

HomeScreen's existing pull-to-refresh already calls `queryClient.invalidateQueries({ stale: true })`. That covers `["facebook-posts"]` automatically — no extra wiring needed.

## Card UI (`CampusNewsCard.tsx`)

Each card: full-width within the carousel viewport, **220px tall**, `rounded-2xl`, `overflow-hidden`.

Stacked layout (absolute positioning):

1. **Hero image** — full-bleed background. Use `expo-image`'s `<Image>` (already wrapped as `@/components/Image`) with `contentFit="cover"`. On error, swap to `assets/placeholder/bg-placeholder.png`. When `resolvePostImage(post.imageUrl)` returns null, use the placeholder directly.
2. **Gradient overlay** — `expo-linear-gradient` (already a transitive dep via expo) from transparent at 40% height down to `rgba(0,0,0,0.8)` at 100%. Spans the bottom 60% of the card to ensure title legibility.
3. **Text block** — absolute-positioned bottom-left, with `padding: 16`:
   - Title: first non-empty line of `message`, `numberOfLines={2}`, `weight="semibold"`, white text, `text-base`.
   - Subtitle: relative time via `dayjs(createdTime).fromNow()` (e.g. "2 days ago"), `text-xs text-white/70`.

Pressable wraps the whole card. On press: `WebBrowser.openBrowserAsync(post.permalinkUrl)`. Active opacity 0.85.

No `postedBy` / avatar (single source, redundant per-card).

## Carousel behavior (`CampusNewsBanner.tsx`)

Wraps `react-native-reanimated-carousel`:

| Prop                       | Value                                                                  |
|----------------------------|------------------------------------------------------------------------|
| `width`                    | viewport width (measured via `onLayout` or screen width minus padding) |
| `height`                   | 220                                                                    |
| `data`                     | `posts`                                                                |
| `autoPlay`                 | `true` if `posts.length > 1` and reduce-motion is OFF, else `false`    |
| `autoPlayInterval`         | 5000                                                                   |
| `loop`                     | `true` if `posts.length > 1`, else `false`                             |
| `scrollAnimationDuration`  | 600                                                                    |
| `pagingEnabled`            | `true`                                                                 |
| `renderItem`               | `({ item }) => <CampusNewsCard post={item} />`                         |

**Pause / resume:** the library handles pause-on-drag natively. After `onScrollEnd`, resume auto-play with a `setTimeout` (~3s) — clear the timeout on next touch. Implement via the carousel's imperative `start()`/`pause()` ref.

**Pagination dots:** custom 15-line component below the carousel — a row of 6px circles, centered, `bg-accent` for the active index, `bg-muted` for others. Synced via `onSnapToItem` / current-index state.

**Reduced motion:** on mount, call `AccessibilityInfo.isReduceMotionEnabled()`; if `true`, set `autoPlay={false}`. Subscribe to `AccessibilityInfo` change events to update if the user toggles the OS setting while the app is open.

### Edge cases

- `posts.length === 0` → return `null` (caller's parent View can be hidden via conditional render, but for simplicity the banner just renders nothing — the section header above it should also be conditionally hidden by HomeScreen).
- `posts.length === 1` → render the single card with no dots, `loop={false}`, `autoPlay={false}`.

### States

- **Loading** (`isLoading`): render `<CampusNewsBannerSkeleton />` — a single full-width 220px `Skeleton` (from `heroui-native`) with three muted dots below. Section header still shown.
- **Error** (`isError`): inline `<ErrorComponent>` (existing) with retry. Rest of HomeScreen still renders.
- **Empty** (`data?.posts.length === 0`): `CampusNewsSection` returns `null` — the section header and banner are both omitted.

## HomeScreen integration

In `screens/main/HomeScreen.tsx`:

```tsx
<Screen>
  <ScreenScrollView
    className="w-full"
    scrollIndicatorInsets={{ right: 1 }}
    refreshControl={<RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />}
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
```

**Opportunistic cleanups bundled in:**

1. Swap the existing inline `<ScrollView style={{ marginBottom: safeBottom }}>` for `<ScreenScrollView>`. The behavior is now identical (no more `+20` extra) and removes local hook plumbing.
2. Drop the now-unused `useScrollBottomInset` import and `safeBottom` local variable.

**Order rationale:** schedule (most actionable) → campus news (institutional) → announcements (community). For non-students, no schedule section, so Campus News becomes the top section.

## Tap behavior

```ts
import * as WebBrowser from "expo-web-browser";
// ...
const onPress = () => {
  WebBrowser.openBrowserAsync(post.permalinkUrl);
};
```

`expo-web-browser` is already in `app.config.ts` plugins. Opens an in-app Chrome Custom Tab / SFSafariViewController; user stays in our app context.

## Accessibility

- Each card has `accessibilityRole="button"` and `accessibilityLabel` = the title (first line of message) + relative time.
- `accessibilityHint` = "Opens the full post on Facebook".
- Reduce-motion respected (auto-play disabled — see Carousel section).
- Pagination dots are decorative; `importantForAccessibility="no"`.

## Testing

No automated layout tests (consistent with project convention). Manual verification:

| Scenario                                       | Expected                                                   |
|------------------------------------------------|------------------------------------------------------------|
| Online, 10 posts                               | Banner auto-advances every 5s, loops, dots track position  |
| Tap a card                                     | In-app browser opens the FB post                           |
| Drag a slide                                   | Auto-advance pauses; resumes ~3s after release             |
| OS reduce-motion enabled                       | Auto-advance off; user can swipe manually                  |
| Single post returned                           | Card shown; no dots; no auto-advance; no loop              |
| Empty response                                 | Section not rendered (header hidden)                       |
| Endpoint error                                 | Inline error with retry; rest of HomeScreen renders normally |
| Post with relative `imageUrl`                  | Placeholder image shown (not the school logo URL)          |
| Hard reload after >6h offline                  | URLs may be expired; broken images fall back to placeholder; refetch on resume produces fresh URLs |
| Pull-to-refresh                                | Banner data refetches alongside Schedule + Announcements   |

## Out of scope

- Pagination (load-more). The endpoint appears to return all available posts in one response (~10 items). YAGNI until we know otherwise.
- Push notifications for new posts.
- Like/comment/share interactions (would require a different API).
- Per-role customization (everyone sees the same banner).
- A standalone "All Campus News" feed page.
- Storing posts in PowerSync for offline access (separate decision — would also require backend changes to the sync model).

## Risks

1. **FB CDN URL expiry** — if a user opens HomeScreen with stale cache (>6h old), images break. Mitigation: aggressive `gcTime` (1h) ensures fresh fetch on most opens; `Image` `onError` falls back to placeholder; pull-to-refresh recovers.
2. **`react-native-reanimated-carousel` interaction with PowerSync providers / NetworkProvider** — none expected (the carousel is self-contained), but watch for re-render loops on first integration.
3. **FB stylized-Unicode rendering** — verified visually that Poppins (the project font) renders the FB-style 𝐛𝐨𝐥𝐝 mathematical alphanumeric symbols using OS fallback fonts. If they render as boxes on some Androids, fall back to stripping the styling via a regex normalize step (not implementing pre-emptively; YAGNI).
