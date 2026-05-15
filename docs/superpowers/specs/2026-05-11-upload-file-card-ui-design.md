# Upload File Card UI/UX Redesign

**Date:** 2026-05-11
**Scope:** `features/assessment/components/questions/ImageBasedQuestion.tsx`
**Status:** Design approved

## Problem

The image-based question card today renders:
- An italic "No file attached yet." line for empty state.
- A bare `<Image>` (or filename text for non-image) when a file is attached.
- Three plain `TouchableOpacity` buttons in a wrapping row: *Take Photo*, *Choose Photo*, *Pick Document*.

There is no remove/replace affordance, no file metadata, no loading or error feedback, and the visual weight of the three custom buttons makes a list of image-based questions noisy. Layout also drifts from the rest of the app, which uses HeroUI Native primitives.

## Goals

- A single, calm empty state that reads as a real form field.
- A clear filled state that confirms what the student attached, with replace/remove actions.
- Source selection moved into a bottom sheet so the card stays compact regardless of how many sources we support.
- Use HeroUI Native components so the card matches the rest of the app and gets theming for free.
- Handle non-image attachments (PDF, etc.) without visual breakage.

## Non-Goals

- Multi-file uploads. One attachment per question, same as today.
- Editing/cropping attachments before upload.
- Changing the PowerSync write path or the field name (`uploaded_file`).
- Resolving the related backend 400 (separate issue: empty-string `uploaded_file` rejected by server FileField). That fix is tracked elsewhere; this redesign assumes the field is only written when a file is actually attached.

## Design

### Empty State

A single inline strip with an icon tile, two-line label, and a primary "Add" button on the right:

```
┌──────────────────────────────────────────┐
│  [📎]  No attachment                     │
│        Add a photo or document   [ Add ] │
└──────────────────────────────────────────┘
```

- Strip is a `Surface` (HeroUI) with `border` and `rounded-lg` styling.
- Icon tile: 38×38, rounded, neutral background, paperclip glyph.
- Right button: HeroUI `Button variant="primary" size="sm"` labeled "Add". Pressing it opens the source `BottomSheet`.

### Filled State

Replaces the empty strip with an inline preview strip (same vertical footprint):

```
┌──────────────────────────────────────────┐
│  [thumb]  my-solution-photo.jpeg    [✕]  │
│           Image · 1.2 MB                 │
└──────────────────────────────────────────┘
   [ Replace attachment ]
```

- Thumbnail: 44×44 rounded.
  - Image attachment → `<Image>` of the local URI.
  - Non-image → file-type icon tile (PDF / DOC / generic) on a neutral background.
- Metadata:
  - Line 1: filename (single line, ellipsized).
  - Line 2: `Type · Size` (e.g., `Image · 1.2 MB`, `PDF · 340 KB`).
- Remove (`✕`) button on the right of the strip clears the attachment.
- Below the strip, a single full-width `Button variant="tertiary"` labeled **Replace attachment** opens the same bottom sheet.

### Source Picker (BottomSheet)

Triggered by **Add** (empty state) or **Replace attachment** (filled state). HeroUI `BottomSheet` with three full-width rows and a cancel handle:

```
┌──────────────────────────────────────────┐
│              ──── handle ────            │
│  📷  Take photo                          │
│  🖼️  Choose from gallery                 │
│  📄  Pick document                       │
│                                          │
│              [ Cancel ]                  │
└──────────────────────────────────────────┘
```

- Each row is a `Pressable` with icon + label, full width, comfortable thumb-reach height.
- Cancel dismisses the sheet without picking.
- After a successful pick, the sheet auto-dismisses and the filled state renders.

### Loading State

While the picker is awaiting the OS picker result, or while a document is being copied to the cache, show a small spinner overlay on the strip (replacing or layering over the icon tile). This is brief; mostly visible for `DocumentPicker`.

### Error State

On pick failure (permission denied not handled here — that flow already returns early), render an inline error line under the strip:

> Couldn't attach. Try again.

No `Alert.alert`. The error clears the next time the source sheet is opened.

### Disabled / Locked State

When the question/attempt is disabled (`disabled` prop is true, e.g. attempt submitted):
- Filled state: show the preview strip *without* the remove (`✕`) button and *without* the Replace button. Read-only confirmation.
- Empty state: show the strip but hide the Add button. The "No attachment" copy remains so it's clear nothing was submitted.

## Components and File Layout

All work lives inside `features/assessment/components/questions/`. To keep `ImageBasedQuestion.tsx` focused, split the new UI into small co-located pieces:

```
features/assessment/components/questions/
  ImageBasedQuestion.tsx                 (orchestrates; owns picker logic)
  upload/
    UploadCard.tsx                       (renders empty | filled | disabled)
    UploadEmpty.tsx                      (strip + Add button)
    UploadFilled.tsx                     (strip + Replace button)
    SourcePickerSheet.tsx                (HeroUI BottomSheet wrapper)
    fileMeta.ts                          (pure helpers: type label, size, ext → icon)
```

Each piece has one job and is independently readable:
- `UploadCard` owns the empty/filled/disabled switch and passes through callbacks.
- `UploadEmpty` and `UploadFilled` are pure presentational components.
- `SourcePickerSheet` encapsulates HeroUI `BottomSheet` open/close and the three source rows.
- `fileMeta.ts` exposes `getFileMeta(uri)` returning `{ filename, type: "image" | "pdf" | "doc" | "other", size?: number }` and `formatSize(bytes)`. Uses `FileSystem.getInfoAsync` for size; falls back gracefully if unavailable.

`ImageBasedQuestion.tsx` keeps the existing `handlePick` (camera / library / document) logic and now passes:
- `currentUpload` (URI or null) to `UploadCard`
- `onChooseSource(source)` to the sheet
- `onRemove()` to clear the attachment (calls `onUpload(question.id, "")` — same shape as today)

## Data Flow

No change to the public contract of `ImageBasedQuestion`:
- `currentUpload: string | null | undefined`
- `onUpload(questionId, uri | "")` — empty string indicates removal.
- `disabled: boolean`

The PowerSync `Connector` already treats `file://...` strings as files and other values as JSON fields (`powersync/Connector.ts:24-40`). Sending `""` for removal keeps the same shape the rest of the app uses.

## Visual Conventions

- Reuse existing colors from `questionStyles` where it makes sense; otherwise rely on HeroUI Native semantic variants for theming (light/dark).
- Don't add raw hex colors beyond what `questionStyles` already exposes. Prefer `Surface`, `Button`, and HeroUI tokens.
- Icons: use whatever icon library the project already uses for question UI. If none, inline `react-native-svg` glyphs are acceptable for the five icons needed (paperclip, camera, gallery, document, close).

## Testing

Manual on device/emulator:
- Empty state renders, Add opens sheet.
- Pick from each source → filled state with correct thumbnail/metadata.
- Replace from filled state opens sheet, replaces attachment.
- Remove (`✕`) returns to empty state.
- Non-image (PDF) shows file-type icon, filename, `PDF · <size>`.
- Disabled mode hides action buttons in both states.
- Permission-denied paths still alert (unchanged from current behavior).
- Pick failure shows inline error line.
- Long filename ellipsizes on a single line.

## Out of Scope (explicit non-asks)

- Multi-file support.
- Inline image cropping/rotation.
- Upload progress (PowerSync handles the actual upload off-screen; we only show local pick state).
- Backend serializer changes for empty `uploaded_file`.
