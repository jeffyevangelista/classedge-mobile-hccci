# Campus News Banner — Image Fit & Gradient Polish

**Date:** 2026-06-02
**Status:** Design — pending implementation plan
**Builds on:** [2026-05-28-campus-news-design.md](./2026-05-28-campus-news-design.md)

## Goal

Improve how `CampusNewsCard` renders varying-aspect-ratio Facebook photos and adjust the bottom title gradient. Today the card uses a single `contentFit="cover"` image at fixed 220px height, which crops portrait and square photos heavily. The fix layers a contained foreground image over a same-image blurred backdrop so the photo is always shown in full, and the empty space picks up the photo's own colors.

## Non-goals

- No data-model change. `FacebookPost.imageUrl` remains a single string.
- No detail screen, modal, or bottom sheet. Tap still opens `permalinkUrl` in `expo-web-browser` (per the original design).
- No carousel changes (autoplay, dots, reduce-motion, pause behavior all unchanged).
- No typography family change. The card already uses Poppins via `AppText`.
- No section-header changes.
- No backend changes. The relative-URL fallback for posts without real images (`/static/assets/img/HCCCI-logo.png`) continues to render the local placeholder.
- No "See all" page, in-app detail route, source badge, autoplay timing change, or pagination-indicator style change. Scoped explicitly out.

## What changes

Two diffs, both inside `features/campus-news/components/CampusNewsCard.tsx`:

1. **Image stack — single layer → two layers.**

   Today: one `<Image>` with `contentFit="cover"` filling the 220px card.

   New: a blurred backdrop layer plus a contained foreground layer, both using the same resolved URI so expo-image's HTTP cache fetches the source exactly once.

   ```tsx
   <View style={{ height: 220 }} className="rounded-2xl overflow-hidden">
     {resolved ? (
       <>
         <Image
           source={{ uri: resolved }}
           contentFit="cover"
           blurRadius={24}
           accessible={false}
           className="absolute inset-0 w-full h-full"
         />
         <Image
           source={{ uri: resolved }}
           contentFit="contain"
           transition={200}
           className="absolute inset-0 w-full h-full"
         />
       </>
     ) : (
       <Image
         source={placeholder}
         contentFit="cover"
         className="w-full h-full"
       />
     )}
     <LinearGradient ... />
     <View ... text overlay />
   </View>
   ```

   Notes:
   - The backdrop is marked `accessible={false}` since it's decorative; the accessibility label on the wrapping `Pressable` (title + relative time) is unchanged.
   - When `resolved === null` (placeholder fallback), we render only the placeholder with `contentFit="cover"` (today's behavior) — no point blurring a static logo.
   - `blurRadius={24}` is the starting value; we may tune ±4 during visual verification.

2. **Bottom gradient stops change.**

   Today:
   ```tsx
   <LinearGradient
     colors={["transparent", "rgba(0,0,0,0.85)"]}
     locations={[0.4, 1]}
     ...
   />
   ```

   New:
   ```tsx
   <LinearGradient
     colors={["transparent", "rgba(0,0,0,0.88)"]}
     locations={[0.5, 1]}
     ...
   />
   ```

   Slightly tighter coverage (starts at 50% instead of 40%) and slightly darker bottom (0.88 instead of 0.85) — keeps title legible against the brighter backdrop without dimming the photo as much.

## What stays the same

- Card height 220px, rounded-2xl, overflow-hidden.
- Pressable wrapper, `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityHint`.
- Tap behavior — `WebBrowser.openBrowserAsync(post.permalinkUrl)`.
- Title (Poppins semibold, `text-base`, white, `numberOfLines={2}`).
- Meta (Poppins regular, `text-xs`, white/70).
- Carousel mechanics in `CampusNewsBanner` — autoplay, dots, reduce-motion handling, pause-on-scroll-then-resume.
- React Query caching (30 min staleTime, 1 hr gcTime).
- `resolvePostImage()` — relative paths still resolve to `null` and trigger the placeholder.
- All states: loading skeleton (`CampusNewsBannerSkeleton`), error (`ErrorComponent`), offline-empty (`OfflineEmpty`), empty (returns `null`).
- All other files in `features/campus-news/`.

## Edge cases

| Case | Behavior |
|---|---|
| Landscape photo (e.g. 3:2) | Foreground fits to card height, narrow blurred strips on left/right. |
| Portrait photo (e.g. 3:4) | Foreground fits to card height, wider blurred strips on left/right. |
| Square photo | Foreground fits to card height, blurred strips on left/right. |
| Panorama (wider than card aspect) | Foreground fits to card width, blurred strips on top/bottom. |
| `resolvePostImage()` returns `null` (relative path / empty) | Skip backdrop, show placeholder filling the card with `contentFit="cover"` (today's behavior). |
| Image fails to load (network, FB CDN expiry) | Both layers fall back; existing `onError` path in expo-image / parent error states are unchanged. |
| Reduced motion | Carousel autoplay already disables; no new motion introduced by this change. |

## Verification

Visual sanity, no automated tests added (the change is purely presentational and the existing carousel/state tests stay valid):

1. Run the app, view the Campus News banner on HomeScreen.
2. Confirm at least one landscape post, one portrait/square post, and the placeholder-fallback post all render with no cropping of the foreground image.
3. Confirm the title and relative time remain legible against the new gradient on light-backdrop photos (e.g. the orange/cream Founders' Day post).
4. Confirm tap still opens the FB permalink in WebBrowser.
5. Confirm iOS and Android both render the blur (expo-image's `blurRadius` is supported on both, but worth eyeballing on a real device given the prior Android SSL drama is firewall-related, not platform).
6. Carousel autoplay rhythm unchanged.

## Open questions

None — all visual decisions made in the brainstorming session are reflected above.
