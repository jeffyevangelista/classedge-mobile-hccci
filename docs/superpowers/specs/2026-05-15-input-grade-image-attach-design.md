# Per-Student Image Attachment on InputGradeScreen

**Date:** 2026-05-15
**Scope:** `screens/main/classroom/InputGradeScreen.tsx` (via `features/classroom/components/StudentScoringList.tsx`)

## Goal

When a teacher is inputting grades for an activity, each student row should let them attach a single supporting image — either by taking a photo or picking one from the device library. The thumbnail appears inline on the row. Tapping it opens a full-screen, pinch-zoomable view. The image persists with the student's score via the existing PowerSync attachment pipeline.

## Why

Teachers frequently grade from physical answer sheets. Capturing a photo of the answer sheet alongside the score gives a verifiable trail and helps with re-checks or disputes. The attachment infrastructure for `activity_studentactivity.file` is already in place (`features/attachments/attachments.config.ts:21-26`), but no UI exposes it on this screen yet.

## Non-goals

- Screen-level (one-per-activity) attachments.
- Multiple images per student. Schema's `file` column is a single text reference; one image per student is the bound.
- Saving an image without a score. Schema requires `total_score NOT NULL`; image saves ride with the existing Save flow.
- Editing/cropping/annotation. Out of scope.

## Architecture

```
features/classroom/components/
  StudentScoringList.tsx          ← integrate per-row image state + extended dirty tracking
  StudentScoreItem.tsx            ← NEW: extracted row component
  ImageSourceSheet.tsx            ← NEW: heroui-native BottomSheet w/ "Take Photo" + "Choose from Library"

features/classroom/
  useImagePicker.ts               ← NEW: thin hook wrapping expo-image-picker (gallery path only)

features/attachments/components/
  AttachmentThumbnailImage.tsx    ← NEW: useAttachment-backed thumbnail (mirrors AttachmentAvatarImage)
```

The inline `renderItem` in `StudentScoringList.tsx:255-301` becomes a separate `StudentScoreItem` component. This keeps `StudentScoringList` focused on list-level concerns (search, "apply to all", aggregate save) and lets the row own its own image + sheet state.

## Reuse, don't rebuild

- **`useCamera()`** (`features/camera/useCamera.ts`) — capture + permission handling.
- **`useImage()`** (`providers/ImageProvider.tsx`) — full-screen zoomable view. Call `showImage(uri)` on thumbnail tap. No new full-screen modal.
- **`saveAttachment()`** (`features/classroom/ classroom.service.ts:7`) — copies the temp camera/picker URI into `${documentDirectory}attachments/` and returns the persistent URI.
- **`upsertStudentScore({ file })`** — already accepts `file`. PowerSync's attachment watcher (configured for `activity_studentactivity.file`) uploads the bytes and rewrites the column to the remote attachment path.
- **`useAttachment(path)`** (`features/attachments/hooks/useAttachment.ts`) — resolves an already-uploaded server path to a local cached URI for display.
- **`heroui-native` `BottomSheet`** — same component used in `features/calendar/components/EventDetailModal.tsx`.

## Data flow

### State (lives in `StudentScoringList`)

```ts
type RowImage = { uri: string; dirty: boolean };
const [imagesByStudent, setImagesByStudent] = useState<Record<number, RowImage>>({});
```

Hydrated from `existingScores`: for each row with a non-empty `file`, seed `imagesByStudent[studentId] = { uri: file, dirty: false }`. The `uri` here may be either a local persistent path (recently saved on this device, starts with `file://`) or a remote attachment path (synced from server). The thumbnail renderer discriminates on the prefix:

```ts
const isLocal = uri.startsWith("file://");
// isLocal → render <Image source={{ uri }} /> directly
// otherwise → render <AttachmentAvatarImage>-style component backed by useAttachment(uri)
```

A small new `<AttachmentThumbnailImage path={uri} />` component (mirroring `AttachmentAvatarImage`) handles the non-local case, showing a skeleton while `state !== "synced"` and a broken-image fallback on `failed`.

### Attach flow

1. Tap camera button → open `<ImageSourceSheet />`.
2. User picks:
   - **Take Photo** → `useCamera().ensurePermission()` → opens fullscreen camera modal → `takePicture()` returns `{ uri }`.
   - **Choose from Library** → `useImagePicker().pick()` → permission check → `launchImageLibraryAsync({ mediaTypes: "Images", quality: 0.8 })` returns `{ uri }`.
3. `const persistent = await saveAttachment(uri)`.
4. `setImagesByStudent(prev => ({ ...prev, [studentId]: { uri: persistent, dirty: true } }))`.

### View flow

- **Tap thumbnail** → `useImage().showImage(resolvedUri)` (resolvedUri = local persistent URI if available, otherwise the `useAttachment`-resolved URI).
- **Tap ×** → `setImagesByStudent(prev => ({ ...prev, [studentId]: { uri: "", dirty: true } }))`.

### Save flow

`dirtyStudentIds` (currently `StudentScoringList.tsx:123-142`) becomes the union of:
- existing score-dirty logic, **and**
- `imagesByStudent[studentId]?.dirty === true`.

`handleSubmitAll` (currently `:146-167`) extends its entry construction:

```ts
const entries = Array.from(dirtyStudentIds).map((studentId) => ({
  studentId,
  activityId: activityDetail.id,
  termId: activityDetail.termId,
  activityLocalId: activityDetail.localId,
  subjectId: activityDetail.subjectId,
  totalScore: parseInt(localScores[studentId], 10),
  file: imagesByStudent[studentId]?.uri || null,
}));
```

After `Promise.all` resolves, flip `dirty: false` on the saved rows (keep the URIs).

### Score-required constraint

`total_score` is `NOT NULL`. A row that has an image but no valid score cannot save. Behavior: the row's contribution to `dirtyStudentIds` requires a valid score. If the user attaches an image without entering a score, the row's image is held in memory and the Save button remains disabled for that row's save. The existing red-border-on-score-input treatment for invalid/missing score is sufficient feedback; no new copy needed.

## Row layout

Existing layout (`StudentScoringList.tsx:268`) stays. The rightmost slot swaps:

```
No image:    [ Avatar ] [ Name ] [ Score / Max ] [ ✓ saved? ] [ Camera button 40×40 ]
With image:  [ Avatar ] [ Name ] [ Score / Max ] [ ✓ saved? ] [ Thumbnail 40×40 with × ]
```

- **Thumbnail**: 40×40, `rounded-lg`, `contentFit="cover"`. `Pressable` → `useImage().showImage(uri)`.
- **× button**: 20×20 dark circle in the thumbnail's top-right corner, offset `top: -6, right: -6`. `Icon name="XIcon"`. Matches the dead-code pattern in `StudentScoringList.tsx:395-401`.
- Tap target footprint = identical to the current camera button. No row-height changes.

## Components

### `StudentScoreItem.tsx` (new)

Props:

```ts
{
  student: { studentId: number; profile?: { firstName?: string; lastName?: string; studentPhoto?: string | null } };
  activityDetail: { localId: string; maxScore: number; termId: number; subjectId: number; id: string };
  score: string;
  isSaved: boolean;
  image: { uri: string; dirty: boolean } | undefined;
  onScoreChange: (studentId: number, value: string) => void;
  onImageChange: (studentId: number, image: { uri: string; dirty: boolean } | null) => void;
}
```

Owns local state: `showSheet`, `showCamera`. Renders the card row, the action `<ImageSourceSheet />`, and the camera modal (moved over from the dead-code block).

### `ImageSourceSheet.tsx` (new)

```ts
{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPickCamera: () => void;       // closes sheet, opens camera modal in parent
  onPickLibrary: () => void;      // closes sheet, runs gallery flow
}
```

Two-button list inside a heroui-native `BottomSheet`. Mirrors `EventDetailModal.tsx` structure (Portal + Overlay + Content).

### `useImagePicker.ts` (new)

```ts
export const useImagePicker = () => {
  const ensurePermission = async (): Promise<boolean> => { /* mirror useCamera pattern */ };
  const pick = async (): Promise<{ uri: string } | null> => {
    const granted = await ensurePermission();
    if (!granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    return { uri: result.assets[0].uri };
  };
  return { ensurePermission, pick };
};
```

## Error handling

| Case | Handling |
|---|---|
| Camera permission denied (canAskAgain) | Existing `useCamera` Alert with "Open Settings" |
| Camera permission denied (re-prompt allowed) | Silent — user can retry |
| Gallery permission denied | Mirror useCamera Alert pattern in `useImagePicker` |
| User cancels camera or picker | No-op; row state unchanged |
| `saveAttachment` copy fails | Catch in handler, Alert "Failed to save image. Try again."; row state unchanged |
| `upsertStudentScore` fails during save | Existing `console.error` path; row dirty flags stay set so the user can retry |
| Hydrated image is a remote path still downloading | Show 40×40 `Skeleton` thumbnail; on `synced`, render image |
| Hydrated image fails to download | Show broken-image icon; tap retries via `useAttachment().retry` |

## Testing

Manual (no component tests exist for this feature):

1. Tap camera button → action sheet appears with "Take Photo" and "Choose from Library".
2. Take Photo → thumbnail appears in 40×40 slot. Score input remains editable.
3. Choose from Library → thumbnail appears the same way.
4. Tap thumbnail → fullscreen zoomable view (existing `ImageProvider`).
5. Tap × on thumbnail → thumbnail clears, camera button returns. Row stays dirty if score also changed.
6. Enter score + attach image → Save → kill app → reopen InputGradeScreen → image persists, thumbnail renders from synced attachment.
7. Attach an image to a row that already has a saved score (no score change) → Save button enables → Save → image persists.
8. Deny camera permission via OS prompt → Alert with "Open Settings" link. Same for gallery.
9. Try to save a row with an image but no score → row does not save; score input shows error treatment.

## Open questions

None — all key constraints (schema fit, score-required, BottomSheet pattern, fullscreen reuse) confirmed during brainstorming.
