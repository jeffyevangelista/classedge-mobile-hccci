# Upload File Card UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare three-button upload UI in `ImageBasedQuestion` with a HeroUI-styled card that has a calm empty state, a confirmation-grade filled state with remove/replace actions, and a bottom-sheet source picker.

**Architecture:** Extract a small `upload/` subfolder co-located with the question components. `UploadCard` orchestrates `UploadEmpty` / `UploadFilled` based on whether a URI exists, and opens a `SourcePickerSheet` (HeroUI `BottomSheet`) for source selection. A pure `fileMeta.ts` module computes filename / type / size from a local URI. `ImageBasedQuestion` keeps the existing `expo-image-picker` / `expo-document-picker` logic and is reduced to wiring.

**Tech Stack:** React Native (Expo), TypeScript, HeroUI Native (`BottomSheet`, `Button`), Uniwind (Tailwind for RN), `phosphor-react-native` (via `components/Icon.tsx`), `expo-file-system/legacy` (for size lookup), `expo-image-picker`, `expo-document-picker`.

**Project verification commands:**
- Typecheck: `pnpm typecheck` (runs `tsc --noEmit`)
- Lint: `pnpm lint` (runs `biome check .`)
- No unit-test runner is configured in this project; verification is `typecheck` + `lint` + manual device check. Each task ends with these.

**Manual smoke checklist (used for every task that touches UI):**
1. Open an assessment that has an image-based question.
2. The card renders without RN warnings in Metro logs.
3. For Task 6 onward, also exercise the affected interaction (add / replace / remove / disabled).

---

## File Structure

Create:
- `features/assessment/components/questions/upload/fileMeta.ts` — pure helpers (filename, type, size formatting, async meta lookup).
- `features/assessment/components/questions/upload/SourcePickerSheet.tsx` — HeroUI `BottomSheet` with three source rows.
- `features/assessment/components/questions/upload/UploadEmpty.tsx` — inline strip + Add button.
- `features/assessment/components/questions/upload/UploadFilled.tsx` — preview strip + Replace button + remove (X).
- `features/assessment/components/questions/upload/UploadCard.tsx` — orchestrator (empty | filled, error line, sheet).

Modify:
- `features/assessment/components/questions/ImageBasedQuestion.tsx` — replace inline UI with `UploadCard`; keep `handlePick` logic but receive a single `source` argument; add inline error state.

No other files are touched. The PowerSync `Connector`, the question types in `types.ts`, the styles file `styles.ts`, and the public contract of `onUpload(questionId, uri | "")` are all unchanged.

---

## Task 1: Add `fileMeta.ts` pure helpers

**Files:**
- Create: `features/assessment/components/questions/upload/fileMeta.ts`

- [ ] **Step 1: Create the helper module**

Write the following file:

```ts
// features/assessment/components/questions/upload/fileMeta.ts
import * as FileSystem from "expo-file-system/legacy";

export type FileMetaType = "image" | "pdf" | "doc" | "other";

export interface FileMeta {
  filename: string;
  type: FileMetaType;
  size?: number;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "heic"];
const DOC_EXTS = ["doc", "docx", "rtf", "txt", "odt"];

export const getExt = (uri: string): string => {
  const cleaned = uri.split("?")[0].split("#")[0];
  const base = cleaned.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
};

export const getFileType = (uri: string): FileMetaType => {
  const ext = getExt(uri);
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (DOC_EXTS.includes(ext)) return "doc";
  return "other";
};

export const getFilename = (uri: string): string => {
  const cleaned = uri.split("?")[0].split("#")[0];
  const last = cleaned.split("/").pop() ?? "attachment";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

export const formatSize = (bytes?: number): string | null => {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const typeLabel = (type: FileMetaType): string => {
  switch (type) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "doc":
      return "Document";
    default:
      return "File";
  }
};

export const getFileMeta = async (uri: string): Promise<FileMeta> => {
  const filename = getFilename(uri);
  const type = getFileType(uri);
  let size: number | undefined;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && "size" in info && typeof info.size === "number") {
      size = info.size;
    }
  } catch {
    // Best-effort; size stays undefined.
  }
  return { filename, type, size };
};
```

- [ ] **Step 2: Verify typecheck and lint pass**

Run: `pnpm typecheck`
Expected: exits 0 with no errors related to this file.

Run: `pnpm lint`
Expected: exits 0 with no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add features/assessment/components/questions/upload/fileMeta.ts
git commit -m "feat(assessment): add fileMeta helpers for upload card"
```

---

## Task 2: Add `SourcePickerSheet` component

**Files:**
- Create: `features/assessment/components/questions/upload/SourcePickerSheet.tsx`

Reference HeroUI `BottomSheet` usage pattern: `features/calendar/components/EventDetailModal.tsx:49-63`.

- [ ] **Step 1: Create the component**

Write the following file:

```tsx
// features/assessment/components/questions/upload/SourcePickerSheet.tsx
import { Pressable, View } from "react-native";
import { BottomSheet } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

export type UploadSource = "camera" | "library" | "document";

interface Row {
  source: UploadSource;
  icon: IconName;
  label: string;
}

const ROWS: Row[] = [
  { source: "camera", icon: "Camera", label: "Take photo" },
  { source: "library", icon: "Image", label: "Choose from gallery" },
  { source: "document", icon: "File", label: "Pick document" },
];

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (source: UploadSource) => void;
}

export const SourcePickerSheet = ({ isOpen, onOpenChange, onPick }: Props) => {
  const handlePick = (source: UploadSource) => {
    onOpenChange(false);
    onPick(source);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["35%"]}
          enableDynamicSizing={false}
          className="bg-overlay"
        >
          <View className="px-4 pt-2 pb-6">
            {ROWS.map((r, idx) => (
              <Pressable
                key={r.source}
                onPress={() => handlePick(r.source)}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                className={`flex-row items-center gap-3 py-4 ${
                  idx < ROWS.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <Icon name={r.icon} size={22} />
                <AppText className="text-base">{r.label}</AppText>
              </Pressable>
            ))}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};
```

If `IconName` is not exported from `components/Icon.tsx`, also update that file by changing line 4 from `export type IconName = keyof typeof PhosphorIcons;` (already exported in the current code at `components/Icon.tsx:4`) — no change needed; verify it is exported.

- [ ] **Step 2: Verify typecheck and lint pass**

Run: `pnpm typecheck`
Expected: exits 0.

Run: `pnpm lint`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add features/assessment/components/questions/upload/SourcePickerSheet.tsx
git commit -m "feat(assessment): add SourcePickerSheet for upload card"
```

---

## Task 3: Add `UploadEmpty` component

**Files:**
- Create: `features/assessment/components/questions/upload/UploadEmpty.tsx`

- [ ] **Step 1: Create the component**

```tsx
// features/assessment/components/questions/upload/UploadEmpty.tsx
import { View } from "react-native";
import { Button } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

interface Props {
  onAdd: () => void;
  disabled?: boolean;
}

export const UploadEmpty = ({ onAdd, disabled }: Props) => {
  return (
    <View className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-3">
      <View className="w-10 h-10 rounded-md bg-default items-center justify-center">
        <Icon name="Paperclip" size={20} />
      </View>
      <View className="flex-1">
        <AppText weight="semibold" className="text-sm">
          No attachment
        </AppText>
        <AppText className="text-xs text-muted">
          Add a photo or document
        </AppText>
      </View>
      {!disabled && (
        <Button variant="primary" size="sm" onPress={onAdd}>
          Add
        </Button>
      )}
    </View>
  );
};
```

- [ ] **Step 2: Verify typecheck and lint pass**

Run: `pnpm typecheck`
Expected: exits 0.

Run: `pnpm lint`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add features/assessment/components/questions/upload/UploadEmpty.tsx
git commit -m "feat(assessment): add UploadEmpty strip for upload card"
```

---

## Task 4: Add `UploadFilled` component

**Files:**
- Create: `features/assessment/components/questions/upload/UploadFilled.tsx`

- [ ] **Step 1: Create the component**

```tsx
// features/assessment/components/questions/upload/UploadFilled.tsx
import { Image, Pressable, View } from "react-native";
import { Button } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { formatSize, typeLabel, type FileMeta } from "./fileMeta";

interface Props {
  uri: string;
  meta: FileMeta;
  onReplace: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

const docIconFor = (type: FileMeta["type"]): IconName => {
  switch (type) {
    case "pdf":
      return "FilePdf";
    case "doc":
      return "FileText";
    default:
      return "File";
  }
};

export const UploadFilled = ({
  uri,
  meta,
  onReplace,
  onRemove,
  disabled,
}: Props) => {
  const sizeStr = formatSize(meta.size);
  const subtitle = sizeStr
    ? `${typeLabel(meta.type)} · ${sizeStr}`
    : typeLabel(meta.type);

  return (
    <View>
      <View className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-3">
        <View className="w-11 h-11 rounded-md overflow-hidden bg-default items-center justify-center">
          {meta.type === "image" ? (
            <Image
              source={{ uri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Icon name={docIconFor(meta.type)} size={22} />
          )}
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-sm"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {meta.filename}
          </AppText>
          <AppText className="text-xs text-muted">{subtitle}</AppText>
        </View>
        {!disabled && (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove attachment"
            className="w-7 h-7 rounded-full items-center justify-center"
            hitSlop={10}
          >
            <Icon name="X" size={16} />
          </Pressable>
        )}
      </View>
      {!disabled && (
        <View className="mt-2">
          <Button variant="tertiary" size="sm" onPress={onReplace}>
            Replace attachment
          </Button>
        </View>
      )}
    </View>
  );
};
```

- [ ] **Step 2: Verify typecheck and lint pass**

Run: `pnpm typecheck`
Expected: exits 0.

Run: `pnpm lint`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add features/assessment/components/questions/upload/UploadFilled.tsx
git commit -m "feat(assessment): add UploadFilled preview strip for upload card"
```

---

## Task 5: Add `UploadCard` orchestrator

**Files:**
- Create: `features/assessment/components/questions/upload/UploadCard.tsx`

- [ ] **Step 1: Create the orchestrator**

```tsx
// features/assessment/components/questions/upload/UploadCard.tsx
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Spinner } from "heroui-native";
import { AppText } from "@/components/AppText";
import { UploadEmpty } from "./UploadEmpty";
import { UploadFilled } from "./UploadFilled";
import { SourcePickerSheet, type UploadSource } from "./SourcePickerSheet";
import { getFileMeta, type FileMeta } from "./fileMeta";

interface Props {
  uri?: string | null;
  disabled?: boolean;
  picking?: boolean;
  errorMessage?: string | null;
  onPickSource: (source: UploadSource) => void;
  onRemove: () => void;
}

export const UploadCard = ({
  uri,
  disabled,
  picking,
  errorMessage,
  onPickSource,
  onRemove,
}: Props) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [meta, setMeta] = useState<FileMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (uri) {
      getFileMeta(uri).then((m) => {
        if (!cancelled) setMeta(m);
      });
    } else {
      setMeta(null);
    }
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const openSheet = () => setSheetOpen(true);

  return (
    <View>
      <View>
        {uri && meta ? (
          <UploadFilled
            uri={uri}
            meta={meta}
            onReplace={openSheet}
            onRemove={onRemove}
            disabled={disabled}
          />
        ) : (
          <UploadEmpty onAdd={openSheet} disabled={disabled} />
        )}
        {picking ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center bg-background/60 rounded-lg"
          >
            <Spinner size="sm" />
          </View>
        ) : null}
      </View>

      {errorMessage ? (
        <AppText className="text-xs text-danger mt-2">{errorMessage}</AppText>
      ) : null}

      <SourcePickerSheet
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        onPick={onPickSource}
      />
    </View>
  );
};
```

- [ ] **Step 2: Verify typecheck and lint pass**

Run: `pnpm typecheck`
Expected: exits 0.

Run: `pnpm lint`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add features/assessment/components/questions/upload/UploadCard.tsx
git commit -m "feat(assessment): add UploadCard orchestrator"
```

---

## Task 6: Refactor `ImageBasedQuestion` to use `UploadCard`

**Files:**
- Modify: `features/assessment/components/questions/ImageBasedQuestion.tsx` (replace the entire file)

- [ ] **Step 1: Replace the file**

Replace the contents of `features/assessment/components/questions/ImageBasedQuestion.tsx` with:

```tsx
import { useState } from "react";
import { Alert, View } from "react-native";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { UploadCard } from "./upload/UploadCard";
import type { UploadSource } from "./upload/SourcePickerSheet";

const ImageBasedQuestion = ({
  question,
  currentUpload,
  onUpload,
  disabled,
}: QuestionComponentProps) => {
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const handlePickSource = async (source: UploadSource): Promise<void> => {
    if (disabled || !onUpload || picking) return;
    setError(null);
    setPicking(true);

    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission required", "Camera access was denied.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          onUpload(question.id, result.assets[0].uri);
        }
      } else if (source === "library") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission required", "Photo library access was denied.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          onUpload(question.id, result.assets[0].uri);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets[0]) {
          onUpload(question.id, result.assets[0].uri);
        }
      }
    } catch (err) {
      console.error("[ImageBasedQuestion] Pick failed:", err);
      setError("Couldn't attach. Try again.");
    } finally {
      setPicking(false);
    }
  };

  const handleRemove = () => {
    if (disabled || !onUpload) return;
    setError(null);
    onUpload(question.id, "");
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>

      <UploadCard
        uri={currentUpload}
        disabled={disabled}
        picking={picking}
        errorMessage={error}
        onPickSource={handlePickSource}
        onRemove={handleRemove}
      />
    </View>
  );
};

export default ImageBasedQuestion;
```

- [ ] **Step 2: Verify typecheck and lint pass**

Run: `pnpm typecheck`
Expected: exits 0.

Run: `pnpm lint`
Expected: exits 0.

- [ ] **Step 3: Manual smoke test on a device or emulator**

Launch the app, open an active assessment attempt that contains an image-based question, and verify:

1. **Empty state** renders: paperclip tile, "No attachment" / "Add a photo or document", primary "Add" button on the right.
2. Tapping **Add** opens the bottom sheet with three rows: *Take photo*, *Choose from gallery*, *Pick document*.
3. **Take photo** path: camera opens, capture → filled state shows thumbnail (image), filename, "Image · <size>".
4. **Choose from gallery** path: picker opens, select an image → filled state shows thumbnail + correct metadata.
5. **Pick document** path: picker opens, select a PDF → filled state shows `FilePdf` icon (no thumbnail), filename, "PDF · <size>".
6. **Replace attachment** button opens the same sheet; picking a new source overwrites the attachment.
7. **Remove (X)** clears the attachment back to the empty state.
8. **Disabled mode** (open an already-submitted attempt or use the read-only view): the filled state hides the `X` button and the "Replace attachment" button; the empty state hides the "Add" button.
9. **Long filename** (e.g., a file with a long name in the iOS DocumentPicker) ellipsizes in the middle on a single line.
10. **Permission denied** path still triggers an `Alert.alert` (unchanged from previous behavior).
11. **Forced pick failure** (optional): the inline error line "Couldn't attach. Try again." renders under the strip. Easiest way: temporarily throw inside `handlePickSource` and confirm the error renders, then revert.

- [ ] **Step 4: Commit**

```bash
git add features/assessment/components/questions/ImageBasedQuestion.tsx
git commit -m "refactor(assessment): use UploadCard in ImageBasedQuestion"
```

---

## Final Verification

- [ ] **Run full project verification**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0 with no errors.

- [ ] **Re-walk the manual smoke checklist from Task 6 Step 3** to confirm nothing regressed when the orchestrator was committed.

- [ ] **Spot-check the PowerSync upload path** by attaching an image and watching Metro logs for the existing `[Connector] op:` log line. Expected: `hasFile: true` and `fileFields: [{ field: "uploaded_file", uri: "file://..." }]` for the PUT op, same as before — this redesign does not change the upload contract.
