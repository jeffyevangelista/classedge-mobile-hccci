# Assessment Instructions Section Design

**Date:** 2026-05-11
**Scope:** `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx` + new sub-component.
**Status:** Approved.
**Builds on:** `docs/superpowers/specs/2026-05-11-assessment-details-screen-design.md`

## Problem

Two schema fields are not surfaced anywhere in the assessment-details flow:

- `assessmentTable.activityInstruction: text` — free-form text instructions for the assessment.
- `assessmentTable.activityFileInstruction: text` — a PowerSync attachment path/id for a file teachers attach (typically PDF or image).

The earlier redesign noted both as "out of scope" placeholders. This extension adds them.

## Goals

- Render `activityInstruction` text when non-empty, with a collapse/expand for long bodies.
- Render `activityFileInstruction` as a compact "tap to view" card that opens a fullscreen viewer.
- Reuse the existing `useAttachment` hook and file-type detection that already power `screens/main/courses/course/material/MaterialDetailsScreen.tsx`.
- Hide the whole section when both fields are empty.
- Remove the now-redundant "File instructions" row from `AssessmentInfoRows`.

## Non-Goals

- Refactoring `MaterialDetailsScreen` to share a viewer component. The new viewer is purpose-built for the compact tap-to-open card pattern; the material screen keeps its inline-preview pattern. We accept a modest amount of repetition between the two screens.
- Editing instructions from the student app. Read-only.
- Server-side schema changes.

## Section Layout

A new section between the hero card and the info rows:

```
┌──────────────────────────────────────────┐
│  Instructions                            │
│  ────────────────────────────────────    │
│  Read each question carefully and        │
│  answer to the best of your ability...   │
│  (clamped to 4 lines by default)         │
│  [ Show more ]                           │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ [📄] instructions.pdf             >│  │ ← tap to view
│  │      PDF · Tap to view             │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

The card uses `Surface` (HeroUI Native) or a styled `View` with `bg-default border border-border rounded-xl`, matching the visual weight of the info-rows card directly below it.

### Visibility

| `activityInstruction.trim()` non-empty | `activityFileInstruction` non-empty | Section visible |
|---|---|---|
| No | No | **No** — section omitted entirely |
| Yes | No | Yes — text only |
| No | Yes | Yes — file card only |
| Yes | Yes | Yes — text on top, file card below, separated by a thin divider |

The section heading "Instructions" only renders when the section is visible.

## Text Block

- `AppText` rendering `activityInstruction`.
- Default state: `numberOfLines={4}` (clamps with ellipsis).
- A `expanded: boolean` state in the section component.
- When `activityInstruction.length > 280`, render a small "Show more" / "Show less" `Pressable` below the text, in `text-accent text-sm`.
- When `expanded`, drop the `numberOfLines` cap and switch the label to "Show less".
- When length ≤ 280, no toggle is shown (the clamp may still apply but won't trim meaningful text).

Rationale for the 280-character threshold: keeps short instructions clean (no toggle), surfaces the toggle only when there's plausibly hidden content. Avoids the complexity of `onTextLayout` overflow detection.

## File Block

A `Pressable` card row:

```
[icon tile]  filename            >
             <type label> · Tap to view
```

- Icon tile: 40×40 rounded square, `bg-default` background. Icon depends on file type:
  - `pdf` → `FilePdf`
  - `image` → `Image`
  - `video` → `FilmSlate`
  - other → `File`

  All icons use the default foreground color (theme-aware) — no per-type color tints. This matches the calm theme-token-only visual language of the assessment redesign, even though `MaterialDetailsScreen` uses hard-coded colored tints.
- Filename: derived from the path's last segment (URL-decoded). Truncate single-line with `numberOfLines={1}` and `ellipsizeMode="middle"`.
- Type label: `"PDF"` / `"Image"` / `"Video"` / `"File"`.
- Right chevron / open glyph (`ArrowSquareOut`).

### File-type detection

Reuse the same extension lists used in `MaterialDetailsScreen.tsx:34-42`. To avoid copy-paste drift, extract them into a small shared module:

- New: `features/attachments/file-type.ts` — exports `IMAGE_EXTS`, `VIDEO_EXTS`, `getFileType(path): "image" | "video" | "pdf" | "other"`.
- `MaterialDetailsScreen.tsx` updates its imports to use this shared module (no behavior change there).

This is the smallest sharing surface that meaningfully reduces duplication without forcing a viewer-component extraction.

### Tap behavior

- **Image** → existing image lightbox via `useImage().showImage(uri)` (same as `MaterialDetailsScreen.ImageCard`).
- **PDF / Video / Other** → fullscreen modal containing a `WebView source={{ uri }}` with a close button. iOS handles all three. On Android, PDFs route through `IntentLauncher.startActivityAsync` for the native viewer (same fallback as `AndroidPDFCard`); video/other use the WebView modal.

The WebView modal lives inside `AssessmentInstructions.tsx`. It does not need to be shared with `MaterialDetailsScreen` (which has a different inline-preview pattern).

### Loading and error states

The card reflects the `useAttachment` `state`:

- `unknown`, `queued`, `downloading` → render the card but replace the icon with `ActivityIndicator`, replace the type label with `"Preparing file…"` / `"Downloading…"`, disable the press.
- `failed` → render the card with a warning icon and a small red "Retry" button on the right. Pressing the row does nothing; pressing Retry calls `useAttachment.retry()`.
- `complete` → the standard tap-to-view card described above.

## Component

Single file: `screens/main/courses/course/assessment/details/AssessmentInstructions.tsx`.

Props:

```ts
interface Props {
  text: string | undefined;
  filePath: string | undefined;
}
```

Internal structure:
- Decide visibility (return `null` if both empty after trim).
- Render section heading.
- Render text block + collapse toggle when `text?.trim()` is non-empty.
- Render a thin divider (`border-t border-border my-3`) when both text and file are present.
- Render file card via internal `InstructionFile` sub-component that owns `useAttachment(filePath)` and the fullscreen viewer modal.

The section is approximately ~250 lines including the WebView modal. If it grows further we can extract `InstructionFile` to its own file.

## Modifications to Existing Components

### `AssessmentInfoRows.tsx`

- Remove `fileInstructionUrl` and `onOpenFileInstruction` props.
- Remove the conditional `Paperclip` "File instructions" row entirely.

### `AssessmentDetailsScreen.tsx`

- Insert `<AssessmentInstructions text={data.activityInstruction} filePath={data.activityFileInstruction || undefined} />` between `<AssessmentHeroCard>` and `<AssessmentInfoRows>`.
- Remove `fileInstructionUrl` and `onOpenFileInstruction` from the props passed to `<AssessmentInfoRows>`.

### `screens/main/courses/course/material/MaterialDetailsScreen.tsx`

- Replace the local `IMAGE_EXTS`, `VIDEO_EXTS`, and `getFileType` definitions (lines 34-50) with an import from the new `features/attachments/file-type.ts`. No behavioral change.

## Visual Conventions

- Theme tokens: `bg-default`, `border-border`, `text-muted`, `text-accent`, `text-danger`. AVOID `text-muted-foreground` / `text-destructive`.
- Icons: `phosphor-react-native` via `@/components/Icon`. Names: `FilePdf`, `Image`, `FilmSlate`, `File`, `ArrowSquareOut`, `WarningCircle`, `ArrowsClockwise`, `X`.
- Buttons inside the WebView modal use plain `TouchableOpacity` with the same close-button style as `MaterialDetailsScreen.IOSPDFViewer` (the patterns are simple enough to repeat verbatim).

## Verification

Manual on a device or simulator:

1. **No instructions, no file** — section is hidden. Hero sits directly above info rows.
2. **Short text only** — section shows with text, no "Show more" toggle, no file card.
3. **Long text only** — section shows with clamped text and a "Show more" toggle. Tapping toggles between clamped and full; the label flips between "Show more" / "Show less".
4. **PDF only** — section shows the file card with PDF icon, filename, "PDF · Tap to view". Tap opens fullscreen WebView (iOS) or native PDF viewer (Android). Loading / failed states render correctly.
5. **Image only** — section shows the file card with Image icon. Tap opens the existing `useImage()` lightbox.
6. **Video only** (edge case) — file card with FilmSlate icon. Tap opens fullscreen WebView.
7. **Text + file** — both render in order, separated by a thin divider.
8. **Material screen still renders attached files** — no regression from the `file-type.ts` extraction.
9. **`pnpm typecheck`** passes with no new errors.

## Out of Scope

- Sharing a single attachment-viewer component between `MaterialDetailsScreen` and the new section.
- Inline previews (the assessment section intentionally uses tap-to-open cards instead of inline PDFs to keep the section compact).
- Edit / upload instructions from the student app.
