# Campus News Banner Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `cover` image in `CampusNewsCard` with a blurred-backdrop + contained-foreground layered fit, and tighten the bottom title gradient. Spec: [docs/superpowers/specs/2026-06-02-campus-news-banner-polish-design.md](../specs/2026-06-02-campus-news-banner-polish-design.md).

**Architecture:** Single-file change in `features/campus-news/components/CampusNewsCard.tsx`. Two `<Image>` layers using the same URI (expo-image's HTTP cache dedupes the network fetch): a blurred `cover` backdrop fills the card, a `contain` foreground shows the full photo on top. `LinearGradient` stops change from `[0.4, 1] / 0.85` to `[0.5, 1] / 0.88`. When `resolvePostImage()` returns `null`, render only the local placeholder (today's behavior). No new files, no new dependencies.

**Tech Stack:** React Native, expo-image (`blurRadius` prop), expo-linear-gradient, NativeWind/Uniwind (Tailwind classes), Poppins via `<AppText>`.

**Repo conventions honored:**
- Typecheck via `npm run typecheck` (= `tsc --noEmit`).
- No automated tests (the change is presentational; spec explicitly opts out). Verification is visual on a real device.
- Staging and committing left to the user per project preference — the plan ends at a working tree ready for review.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `features/campus-news/components/CampusNewsCard.tsx` | Modify only | Single hero card: image stack + gradient + title/meta overlay |

Nothing else is touched.

---

### Task 1: Remove debug `console.log` props left over from the SSL diagnosis

**Files:**
- Modify: `features/campus-news/components/CampusNewsCard.tsx`

**Context:** During the FB CDN SSL diagnosis we added `onError` and `onLoad` console.log handlers to the `<Image>` to capture the trust-anchor error. Now that the firewall issue is resolved and we're polishing the card, strip those debug props first so the polish diff is clean.

- [ ] **Step 1: Open `features/campus-news/components/CampusNewsCard.tsx` and remove the two debug props**

Find this block on the existing `<Image>`:

```tsx
      <Image
        source={resolved ? { uri: resolved } : placeholder}
        placeholder={placeholder}
        className="w-full h-full"
        contentFit="cover"
        transition={200}
        onError={(e) => console.log("[CampusNewsCard] image error:", resolved, e?.error)}
        onLoad={() => console.log("[CampusNewsCard] image loaded:", resolved)}
      />
```

Remove the two `onError` and `onLoad` lines. The block becomes:

```tsx
      <Image
        source={resolved ? { uri: resolved } : placeholder}
        placeholder={placeholder}
        className="w-full h-full"
        contentFit="cover"
        transition={200}
      />
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors related to `CampusNewsCard.tsx`. (Pre-existing errors elsewhere in the repo, if any, are out of scope — only watch for new ones introduced by this edit.)

---

### Task 2: Replace the single `<Image>` with the blurred-backdrop + contained-foreground stack

**Files:**
- Modify: `features/campus-news/components/CampusNewsCard.tsx`

**Context:** This is the core visual change. The card today uses one `<Image>` with `contentFit="cover"`, which crops portrait and square photos to the 220px card height. The new structure renders the photo twice from the same URI:

- **Backdrop layer**: `contentFit="cover"` + `blurRadius={24}`, fills the entire card, decorative.
- **Foreground layer**: `contentFit="contain"`, fits the full photo to the card height (or width for very wide panoramas), keeps `placeholder={placeholder}` so the local `bg-placeholder.png` shows briefly during load and remains visible if the URL ever fails permanently. The backdrop intentionally has no `placeholder` (a blurred placeholder logo would look odd).

Both layers use the same URI; expo-image's HTTP cache means a single network fetch.

When `resolved === null` (the relative-URL `/static/assets/img/HCCCI-logo.png` case, or any non-`http(s)` value), render only the local placeholder filling the card — same as today.

- [ ] **Step 1: Replace the single `<Image>` block from Task 1 with the layered structure**

Find (after Task 1 cleanup):

```tsx
      <Image
        source={resolved ? { uri: resolved } : placeholder}
        placeholder={placeholder}
        className="w-full h-full"
        contentFit="cover"
        transition={200}
      />
```

Replace with:

```tsx
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
```

Why inline `style` for positioning instead of NativeWind classes: it matches the pattern already used by the sibling `<LinearGradient>` in this same file, and avoids ambiguity around whether Uniwind translates `absolute inset-0` correctly on the wrapped `Image`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors for `CampusNewsCard.tsx`. If `blurRadius` or `accessible` flag a type error, confirm expo-image is current: `node -p "require('expo-image/package.json').version"` (any 1.x or 2.x is fine — both expose `blurRadius`).

---

### Task 3: Tighten the bottom title gradient

**Files:**
- Modify: `features/campus-news/components/CampusNewsCard.tsx`

**Context:** The blurred backdrop will surface brighter colors than the previous static `cover` image showed in many cases, so the title needs a slightly darker, slightly tighter scrim to stay legible. Coverage starts at 50% (was 40%) and bottom darkens to `rgba(0,0,0,0.88)` (was `0.85`).

- [ ] **Step 1: Update the `LinearGradient` `colors` and `locations` props**

Find:

```tsx
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
```

Replace with:

```tsx
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
```

Only `colors[1]` (`0.85` → `0.88`) and `locations[0]` (`0.4` → `0.5`) change. The `style` object is unchanged.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

---

### Task 4: Visual verification on a real device

**Files:** none (manual check)

**Context:** The spec opts out of automated tests for this change. Verification is visual. The recent Android SSL failure was a firewall issue and is unrelated to the new code, but worth eyeballing on both platforms since `blurRadius` rendering paths differ slightly between iOS and Android in expo-image.

- [ ] **Step 1: Start the dev build**

Run: `npm run start` (or `npx expo start --dev-client`).
Open the app on a real iOS device and a real Android device (skip the emulator unless you trust its network path).

- [ ] **Step 2: On HomeScreen, inspect every Campus News card by swiping the carousel**

Confirm for each post:

| Aspect | Expected |
|---|---|
| Landscape photo (3:2-ish) | Foreground fills card width, blurred strips on top/bottom (or none if aspect is close to 1.6:1). |
| Portrait photo (3:4-ish) | Foreground fits to card height, wider blurred strips on left/right colored from the photo. |
| Square photo | Foreground fits to card height, blurred strips on left/right. |
| Panorama (very wide) | Foreground fits to card width, blurred strips on top/bottom. |
| Placeholder fallback (the `/static/.../HCCCI-logo.png` post) | Local `bg-placeholder.png` fills the card with `contentFit="cover"`. No blurred backdrop. |
| Title + relative time | Legible against the bottom of the gradient on every post, including bright/light-backdrop photos. |
| Tap | Opens the Facebook permalink in WebBrowser (unchanged). |
| Carousel rhythm | Autoplay, dots, swipe-pause, reduce-motion all unchanged. |

- [ ] **Step 3: Decide — ship or tune**

If the blur looks too soft, drop `blurRadius` to `20`. Too sharp, raise to `28`. Re-verify and stop iterating once the cards read well across the post mix.

If the gradient still washes a particular post, capture which post + which platform and we'll iterate on the stops — but the spec leaves this within the implementer's discretion within ±4 on blurRadius and ±0.05 / ±0.05 on the gradient values.

---

### Final step: Hand back to the user for staging and commit

The working tree is ready for review. The user reviews `git diff features/campus-news/components/CampusNewsCard.tsx`, stages, and commits per their normal flow.

---

## Self-Review

**Spec coverage check (against `2026-06-02-campus-news-banner-polish-design.md`):**

| Spec requirement | Plan task |
|---|---|
| "What changes" #1 — image stack two layers, blurRadius=24, accessible=false backdrop | Task 2 |
| "What changes" #2 — gradient `[0.5, 1] / 0.88` | Task 3 |
| "Placeholder fallback — skip backdrop, fill with `contentFit="cover"`" | Task 2 (else branch) |
| "What stays the same" — Pressable, accessibility, title/meta, carousel | Untouched by all three tasks |
| "Edge cases" — landscape/portrait/square/panorama/placeholder/load-fail | Task 4 verification matrix |
| "Verification" — visual on iOS + Android | Task 4 |
| Debug `console.log` left from prior session | Task 1 |

No spec requirement is unaddressed.

**Placeholder scan:** No "TBD", "TODO", "fill in later", "similar to Task N", or "appropriate error handling" stand-ins.

**Type/symbol consistency:** `resolved`, `placeholder`, `Image`, `LinearGradient`, `Pressable`, `AppText` — all identifiers in the new code match what already exists in the file.
