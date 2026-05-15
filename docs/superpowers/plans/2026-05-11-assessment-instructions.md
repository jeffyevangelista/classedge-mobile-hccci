# Assessment Instructions Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Instructions" section to the AssessmentDetailsScreen that renders `activityInstruction` (with collapse/expand) and `activityFileInstruction` (compact tap-to-open card with image lightbox / PDF / fullscreen WebView).

**Architecture:** New `AssessmentInstructions` section component slots between the hero and the info-rows card. It owns the text block + collapse toggle + file card + fullscreen viewer modal. File downloads ride on the existing `useAttachment` hook; a new entry in `ATTACHMENT_COLUMNS` registers the column with the attachment watcher. The existing `IMAGE_EXTS` / `VIDEO_EXTS` / `getFileType` helpers in `MaterialDetailsScreen.tsx` move to a shared module so both screens share them.

**Tech Stack:** React Native (Expo), TypeScript, HeroUI Native, Uniwind, PowerSync attachments (`useAttachment`), `expo-image-picker` not used, `react-native-webview` for PDF/other viewer, `expo-intent-launcher` + `expo-file-system/legacy` for the Android PDF intent, `@/providers/ImageProvider` for the image lightbox.

**Verification:**
- `pnpm typecheck` — must exit without NEW errors. Pre-existing errors in `AssessmentResult.tsx`, `ScoreDisplayList.tsx`, `StudentScoringList.tsx`, `OneSignalProvider.tsx` are out of scope.
- `pnpm lint` is broken in some local envs (missing biome binary) — that's not a plan failure.
- **DO NOT stage or commit anything.** The user manages git operations themselves. Ignore any "Commit" step boilerplate.

---

## File Structure

Create:
- `features/attachments/file-type.ts` — extracted `IMAGE_EXTS`, `VIDEO_EXTS`, `getFileType(path): "image" | "video" | "pdf" | "other"`.
- `screens/main/courses/course/assessment/details/AssessmentInstructions.tsx` — the new section (text + file + viewer modal).

Modify:
- `features/attachments/attachments.config.ts` — add a 6th entry to `ATTACHMENT_COLUMNS` so the watcher tracks `activity_activity.activity_file_instruction`.
- `screens/main/courses/course/material/MaterialDetailsScreen.tsx` — replace the local extension constants + `getFileType` with imports from the new `file-type.ts` module (no behavior change).
- `screens/main/courses/course/assessment/details/AssessmentInfoRows.tsx` — drop `fileInstructionUrl` and `onOpenFileInstruction` props, drop the conditional Paperclip "File instructions" row.
- `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx` — insert `<AssessmentInstructions>` between hero and info rows; remove the file-instructions props passed to `AssessmentInfoRows`.

No other files are touched.

---

## Task 1: Extract shared file-type helpers

**Files:**
- Create: `features/attachments/file-type.ts`

- [ ] **Step 1: Create the file**

```ts
// features/attachments/file-type.ts

export type FileTypeKind = "image" | "video" | "pdf" | "other";

export const IMAGE_EXTS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "bmp",
  "tiff",
  "tif",
  "avif",
  "jfif",
  "svg",
];

export const VIDEO_EXTS = [
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "m4v",
  "3gp",
  "3g2",
  "wmv",
  "flv",
  "f4v",
  "ts",
  "mts",
  "m2ts",
  "mpg",
  "mpeg",
  "mp2",
  "mpe",
  "ogv",
  "ogg",
  "rm",
  "rmvb",
  "asf",
  "divx",
  "vob",
  "dv",
  "mxf",
];

export const getFileType = (path: string): FileTypeKind => {
  const cleaned = path.split("?")[0].split("#")[0];
  const base = cleaned.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "other";
};
```

The query/fragment strip is a small upgrade over the original `MaterialDetailsScreen` version (`split(".").pop()` only), since attachment paths from PowerSync can include `?` parameters.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors related to this file.

- [ ] **Step 3: Do NOT commit.**

---

## Task 2: Migrate `MaterialDetailsScreen` to the shared module

**Files:**
- Modify: `screens/main/courses/course/material/MaterialDetailsScreen.tsx`

- [ ] **Step 1: Replace the local helpers with the shared import**

In `screens/main/courses/course/material/MaterialDetailsScreen.tsx`:

(a) **Add** the following import near the other `@/features/...` imports:

```ts
import { getFileType } from "@/features/attachments/file-type";
```

(`FileTypeKind` isn't needed by `MaterialDetailsScreen.tsx` — the only call site infers the return type.)

(b) **Delete** the entire local block from line 32 through line 50 (inclusive). That block is:

```tsx
type FileType = "image" | "video" | "pdf" | "other";

const IMAGE_EXTS = [
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif",
  "bmp", "tiff", "tif", "avif", "jfif", "svg",
];
const VIDEO_EXTS = [
  "mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp", "3g2", "wmv",
  "flv", "f4v", "ts", "mts", "m2ts", "mpg", "mpeg", "mp2", "mpe",
  "ogv", "ogg", "rm", "rmvb", "asf", "divx", "vob", "dv", "mxf",
];

function getFileType(path: string): FileType {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "other";
}
```

(c) If the file uses the local `FileType` type anywhere as a value annotation, rename references to `FileTypeKind`. (Search the file for `: FileType` and `FileType[]` and update if found.)

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors. The `MaterialFile` component should still type-check against the imported `getFileType` (same name, same signature).

- [ ] **Step 3: Do NOT commit.**

---

## Task 3: Register `activity_activity.activity_file_instruction` as a tracked attachment column

**Files:**
- Modify: `features/attachments/attachments.config.ts`

- [ ] **Step 1: Add the new column entry**

In `features/attachments/attachments.config.ts`, find the `ATTACHMENT_COLUMNS` array and append a 6th entry. The current array ends after the `module_module` entry (around line 38):

```ts
  {
    table: "module_module",
    column: "file",
    resource: "module",
    priority: 2,
  },
];
```

Change the closing of the array so the new entry is appended:

```ts
  {
    table: "module_module",
    column: "file",
    resource: "module",
    priority: 2,
  },
  {
    table: "activity_activity",
    column: "activity_file_instruction",
    resource: "activity_instructions",
    priority: 2,
  },
];
```

Rationale: `resource` is a tag (the fetcher receives it as `_resource` and ignores it — see `features/attachments/attachments.fetcher.ts:36`), so any descriptive string works. `priority: 2` matches the read-only-reference material pattern used by `module_module.file`. The `TRACKED_TABLES` constant is derived from this array, so the watcher will automatically include `activity_activity`.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors.

- [ ] **Step 3: Do NOT commit.**

---

## Task 4: Add `AssessmentInstructions.tsx`

**Files:**
- Create: `screens/main/courses/course/assessment/details/AssessmentInstructions.tsx`

This is the largest task — a single self-contained section component with text + collapse, file card with attachment-state handling, and a fullscreen viewer modal.

- [ ] **Step 1: Create the file**

```tsx
// screens/main/courses/course/assessment/details/AssessmentInstructions.tsx
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import WebView from "react-native-webview";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { useAttachment } from "@/features/attachments/hooks/useAttachment";
import { getFileType, type FileTypeKind } from "@/features/attachments/file-type";
import { useImage } from "@/providers/ImageProvider";

interface Props {
  text: string | undefined;
  filePath: string | undefined;
}

const COLLAPSE_THRESHOLD = 280;

export const AssessmentInstructions = ({ text, filePath }: Props) => {
  const trimmedText = text?.trim() ?? "";
  const hasText = trimmedText.length > 0;
  const hasFile = !!filePath && filePath.length > 0;

  if (!hasText && !hasFile) return null;

  return (
    <View>
      <AppText weight="semibold" className="text-base mb-2">
        Instructions
      </AppText>
      <View className="rounded-xl bg-default border border-border p-4">
        {hasText ? <InstructionText text={trimmedText} /> : null}
        {hasText && hasFile ? (
          <View className="border-t border-border my-3" />
        ) : null}
        {hasFile ? <InstructionFile filePath={filePath!} /> : null}
      </View>
    </View>
  );
};

const InstructionText = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = text.length > COLLAPSE_THRESHOLD;

  return (
    <View>
      <AppText
        className="text-sm leading-relaxed"
        numberOfLines={!canCollapse || expanded ? undefined : 4}
      >
        {text}
      </AppText>
      {canCollapse ? (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Show less" : "Show more"}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <AppText weight="semibold" className="text-accent text-sm mt-2">
            {expanded ? "Show less" : "Show more"}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
};

const fileIconFor = (kind: FileTypeKind): IconName => {
  switch (kind) {
    case "pdf":
      return "FilePdf";
    case "image":
      return "Image";
    case "video":
      return "FilmSlate";
    default:
      return "File";
  }
};

const fileTypeLabel = (kind: FileTypeKind): string => {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    case "video":
      return "Video";
    default:
      return "File";
  }
};

const getFilename = (path: string): string => {
  const cleaned = path.split("?")[0].split("#")[0];
  const last = cleaned.split("/").pop() ?? "attachment";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

const InstructionFile = ({ filePath }: { filePath: string }) => {
  const { uri, state, retry } = useAttachment(filePath);
  const { showImage } = useImage();
  const [viewerOpen, setViewerOpen] = useState(false);

  const kind = getFileType(filePath);
  const filename = getFilename(filePath);
  const icon = fileIconFor(kind);
  const typeLabel = fileTypeLabel(kind);

  if (state === "unknown" || state === "queued" || state === "downloading") {
    return (
      <View className="flex-row items-center gap-3 rounded-lg bg-default border border-border px-3 py-3">
        <View className="w-10 h-10 rounded-md bg-default items-center justify-center">
          <ActivityIndicator />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-sm"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {filename}
          </AppText>
          <AppText className="text-xs text-muted">
            {state === "downloading" ? "Downloading…" : "Preparing file…"}
          </AppText>
        </View>
      </View>
    );
  }

  if (state === "failed") {
    return (
      <View className="flex-row items-center gap-3 rounded-lg bg-default border border-border px-3 py-3">
        <View className="w-10 h-10 rounded-md bg-default items-center justify-center">
          <Icon name="WarningCircle" size={20} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-sm"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {filename}
          </AppText>
          <AppText className="text-xs text-danger">Failed to load file</AppText>
        </View>
        <TouchableOpacity
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg border border-border"
        >
          <Icon name="ArrowsClockwise" size={13} />
          <AppText className="text-xs">Retry</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (!uri) return null;

  const handleOpen = async () => {
    if (kind === "image") {
      showImage(uri);
      return;
    }
    if (kind === "pdf" && Platform.OS === "android") {
      try {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          type: "application/pdf",
          flags: 1,
        });
      } catch {
        // Fall back to the in-app viewer if the OS chooser fails.
        setViewerOpen(true);
      }
      return;
    }
    setViewerOpen(true);
  };

  return (
    <>
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${filename}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        className="flex-row items-center gap-3 rounded-lg bg-default border border-border px-3 py-3"
      >
        <View className="w-10 h-10 rounded-md bg-default items-center justify-center">
          <Icon name={icon} size={22} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-sm"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {filename}
          </AppText>
          <AppText className="text-xs text-muted">
            {typeLabel} · Tap to view
          </AppText>
        </View>
        <Icon name="ArrowSquareOut" size={16} />
      </Pressable>

      <Modal
        visible={viewerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerOpen(false)}
      >
        <StatusBar hidden={false} barStyle="default" />
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: "#000",
            }}
          >
            <TouchableOpacity
              onPress={() => setViewerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: 6,
              }}
            >
              <Icon name="X" size={20} color="#e5e5e5" />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri }}
            style={{ flex: 1, backgroundColor: "#fff" }}
            originWhitelist={["*"]}
            javaScriptEnabled
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors related to this file. If TypeScript complains about an icon name (e.g., `WarningCircle` vs `WarningCircleIcon`), substitute the closest valid `IconName` (e.g., the `MaterialDetailsScreen` uses `WarningCircleIcon` — both forms may exist; pick whichever `keyof typeof PhosphorIcons` resolves).

- [ ] **Step 3: Do NOT commit.**

---

## Task 5: Drop the file-instructions row from `AssessmentInfoRows`

**Files:**
- Modify: `screens/main/courses/course/assessment/details/AssessmentInfoRows.tsx`

- [ ] **Step 1: Drop two props**

In the `Props` interface, remove these two lines:

```ts
  fileInstructionUrl: string | null;
  onOpenFileInstruction?: () => void;
```

Also remove them from the function-component destructure at the top of `AssessmentInfoRows`.

- [ ] **Step 2: Drop the conditional file row**

Remove the entire block that appends the file row:

```tsx
  if (fileInstructionUrl && onOpenFileInstruction) {
    rows.push({
      key: "file",
      icon: "Paperclip",
      label: "File instructions",
      value: "Download",
      onPress: onOpenFileInstruction,
    });
  }
```

After this change, no row uses `onPress` anymore. The `Row` interface's `onPress?: () => void` field and the `RowItem`'s `if (row.onPress)` Pressable branch can stay (still type-safe; just unused). They don't cost anything and leave the door open for future tappable rows.

Optional cleanup: if you prefer to keep the component lean, you can also remove the `onPress` field from `Row` and the entire Pressable branch in `RowItem` (collapsing `RowItem` to just the `<View>` content). Either is acceptable; the conservative path is to leave them.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors. The consumer (`AssessmentDetailsScreen.tsx`) will fail to compile until Task 6 drops the now-unused props — that's expected.

- [ ] **Step 4: Do NOT commit.**

---

## Task 6: Wire `AssessmentInstructions` into the screen

**Files:**
- Modify: `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx`

- [ ] **Step 1: Add the import**

Near the other `./details/` imports, add:

```ts
import { AssessmentInstructions } from "./details/AssessmentInstructions";
```

- [ ] **Step 2: Insert the section + drop the two info-row props**

Find this JSX block in the screen:

```tsx
          <AssessmentHeroCard
            activityName={data.activityName}
            endTime={data.endTime}
            questionCount={questionCount}
            timeDurationMinutes={data.timeDuration}
            attemptsUsed={attempts?.length}
            maxRetake={data.maxRetake}
          />

          <AssessmentInfoRows
            passingScore={data.passingScore}
            passingScoreType={data.passingScoreType}
            maxScore={data.maxScore}
            retakeMethod={data.retakeMethod}
            isGraded={data.isGraded}
            showScore={data.showScore}
            bestScore={bestScore}
            fileInstructionUrl={data.activityFileInstruction || null}
            onOpenFileInstruction={undefined}
          />
```

Replace with:

```tsx
          <AssessmentHeroCard
            activityName={data.activityName}
            endTime={data.endTime}
            questionCount={questionCount}
            timeDurationMinutes={data.timeDuration}
            attemptsUsed={attempts?.length}
            maxRetake={data.maxRetake}
          />

          <AssessmentInstructions
            text={data.activityInstruction}
            filePath={data.activityFileInstruction || undefined}
          />

          <AssessmentInfoRows
            passingScore={data.passingScore}
            passingScoreType={data.passingScoreType}
            maxScore={data.maxScore}
            retakeMethod={data.retakeMethod}
            isGraded={data.isGraded}
            showScore={data.showScore}
            bestScore={bestScore}
          />
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors related to this file or its dependencies.

- [ ] **Step 4: Manual smoke test on a device or simulator**

For each scenario below, verify the indicated outcome:

1. **Both fields empty** — section is hidden entirely. Hero sits directly above info rows.
2. **Short text only** (`activityInstruction.length <= 280`) — section heading + text, no "Show more" toggle, no file card.
3. **Long text only** — clamped to 4 lines, "Show more" toggle below; tapping flips to full text and label switches to "Show less".
4. **PDF only** — section heading + file card with `FilePdf` icon, filename, `"PDF · Tap to view"`. Tap → fullscreen WebView (iOS) or native Android PDF intent.
5. **Image only** — file card with `Image` icon. Tap → image lightbox via `useImage()`.
6. **Text + file** — both render, separated by a thin divider.
7. **Attachment still downloading** — file card shows a spinner and "Preparing file…" / "Downloading…", press is disabled.
8. **Attachment failed** — file card shows a warning icon, "Failed to load file" in danger color, and a Retry button. Tapping Retry re-queues the attachment.
9. **Long filename** — ellipsizes in the middle on a single line.
10. **Material screen still works** — open a material with an attached file (image / video / PDF). All three viewers still render correctly (no regression from the file-type extraction).
11. **`pnpm typecheck`** passes with no new errors.

- [ ] **Step 5: Do NOT commit.**

---

## Final Verification

- [ ] **Full project typecheck:** `pnpm typecheck` exits with no NEW errors compared to the pre-existing baseline.
- [ ] **Re-walk Task 6 Step 4 scenarios** on the device.
- [ ] **Spot-check the attachment watcher** by tailing Metro logs while the screen mounts — the new attachment should be picked up and downloaded if it's not already cached.
