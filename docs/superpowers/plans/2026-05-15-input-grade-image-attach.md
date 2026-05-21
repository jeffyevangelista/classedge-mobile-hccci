# Per-Student Image Attachment on InputGradeScreen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference:** This user does NOT auto-commit. Each "Commit" step is a pause-point: print the suggested `git add` + `git commit` command but do not execute it. The user runs commits manually.

**Goal:** Let teachers attach one supporting image per student row on `InputGradeScreen` — via camera or photo library — with inline thumbnail, full-screen zoom, and persistence through the existing PowerSync attachment pipeline.

**Architecture:** Three new isolated pieces (a hook, a sheet, a thumbnail-resolver) plus a row component extracted from the inline `renderItem` in `StudentScoringList`. `StudentScoringList` owns `imagesByStudent` state and extends its existing dirty-tracking + save flow to include the `file` column.

**Tech Stack:** Expo (camera + image-picker + image + file-system), heroui-native (BottomSheet), PowerSync (attachment queue), @gorhom/bottom-sheet, phosphor-react-native via `@/components/Icon`.

**Spec:** `docs/superpowers/specs/2026-05-15-input-grade-image-attach-design.md`

**Testing note:** This feature has no existing component-test scaffolding. Each task ends with `pnpm typecheck` and a manual smoke check. End-to-end verification happens in **Task 6**.

---

## File Structure

**Create:**
- `features/classroom/useImagePicker.ts` — hook wrapping `expo-image-picker` (gallery)
- `features/attachments/components/AttachmentThumbnailImage.tsx` — `useAttachment`-backed 40×40 thumbnail with Skeleton/broken-image states
- `features/classroom/components/ImageSourceSheet.tsx` — heroui-native BottomSheet with "Take Photo" / "Choose from Library"
- `features/classroom/components/StudentScoreItem.tsx` — row card extracted from `StudentScoringList`'s inline `renderItem`

**Modify:**
- `features/classroom/components/StudentScoringList.tsx` — add `imagesByStudent` state, extend dirty tracking + save, replace inline renderItem with `<StudentScoreItem />`, delete dead-code `StudentScoreItem` block

---

## Task 1: Create `useImagePicker` hook

**Files:**
- Create: `features/classroom/useImagePicker.ts`

- [ ] **Step 1: Create the hook file**

Path: `features/classroom/useImagePicker.ts`

```ts
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";

export type PickedImage = {
  uri: string;
};

export const useImagePicker = () => {
  const ensurePermission = async (): Promise<boolean> => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) return true;

    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!result.granted) {
      if (!result.canAskAgain) {
        Alert.alert(
          "Photo Library Permission Required",
          "Please enable photo library access in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
      }
      return false;
    }
    return true;
  };

  const pick = async (): Promise<PickedImage | null> => {
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

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS — no new errors in `useImagePicker.ts`.

- [ ] **Step 3: Commit (user runs manually)**

Print this command for the user; do not execute:

```bash
git add features/classroom/useImagePicker.ts
git commit -m "feat(classroom): add useImagePicker hook for gallery selection"
```

---

## Task 2: Create `AttachmentThumbnailImage` component

**Files:**
- Create: `features/attachments/components/AttachmentThumbnailImage.tsx`

- [ ] **Step 1: Create the component file**

Path: `features/attachments/components/AttachmentThumbnailImage.tsx`

```tsx
import { Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import { useAttachment } from "../hooks/useAttachment";

type Props = {
  path: string;
  size?: number;
};

/**
 * useAttachment-backed thumbnail. Mirrors AttachmentAvatarImage but renders a
 * square thumbnail with explicit pending / failed states. Tap-to-retry on failure.
 */
export const AttachmentThumbnailImage = ({ path, size = 40 }: Props) => {
  const { uri, state, retry } = useAttachment(path);

  if (state === "synced" && uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 8 }}
        contentFit="cover"
      />
    );
  }

  if (state === "failed") {
    return (
      <Pressable
        onPress={retry}
        style={[styles.fallback, { width: size, height: size }]}
      >
        <Icon name="ImageBroken" size={size * 0.5} color="#9ca3af" />
      </Pressable>
    );
  }

  return (
    <Skeleton
      style={{ width: size, height: size, borderRadius: 8 }}
    />
  );
};

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default AttachmentThumbnailImage;
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit (user runs manually)**

```bash
git add features/attachments/components/AttachmentThumbnailImage.tsx
git commit -m "feat(attachments): add AttachmentThumbnailImage for synced/pending/failed states"
```

---

## Task 3: Create `ImageSourceSheet` component

**Files:**
- Create: `features/classroom/components/ImageSourceSheet.tsx`

Uses the same BottomSheet pattern as `features/calendar/components/EventDetailModal.tsx:57-72`.

- [ ] **Step 1: Create the component file**

Path: `features/classroom/components/ImageSourceSheet.tsx`

```tsx
import { useCallback, useMemo } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

const BOTTOM_SHEET_MAX_WIDTH = 768;

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
};

export const ImageSourceSheet = ({
  isOpen,
  onOpenChange,
  onPickCamera,
  onPickLibrary,
}: Props) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 0,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    }),
    [screenWidth],
  );

  const handleCamera = useCallback(() => {
    onOpenChange(false);
    onPickCamera();
  }, [onOpenChange, onPickCamera]);

  const handleLibrary = useCallback(() => {
    onOpenChange(false);
    onPickLibrary();
  }, [onOpenChange, onPickLibrary]);

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          enableDynamicSizing
          topInset={Math.max(insets.top, 16)}
          style={contentStyle}
          className="bg-overlay"
        >
          <View className="px-5 pt-2 pb-6 gap-2">
            <AppText weight="semibold" className="text-base mb-2">
              Attach Image
            </AppText>

            <Pressable
              onPress={handleCamera}
              className="flex-row items-center gap-3 py-3 px-3 rounded-xl active:bg-default-100"
            >
              <Icon name="Camera" size={22} />
              <AppText className="text-base">Take Photo</AppText>
            </Pressable>

            <Pressable
              onPress={handleLibrary}
              className="flex-row items-center gap-3 py-3 px-3 rounded-xl active:bg-default-100"
            >
              <Icon name="ImageSquare" size={22} />
              <AppText className="text-base">Choose from Library</AppText>
            </Pressable>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

export default ImageSourceSheet;
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit (user runs manually)**

```bash
git add features/classroom/components/ImageSourceSheet.tsx
git commit -m "feat(classroom): add ImageSourceSheet for camera/library picker"
```

---

## Task 4: Create `StudentScoreItem` component

**Files:**
- Create: `features/classroom/components/StudentScoreItem.tsx`

This is the row card extracted from `StudentScoringList.tsx:255-301`'s inline `renderItem`. It owns: camera modal state, sheet open state, the three flows (camera, library, delete), and the thumbnail tap → `useImage().showImage()`.

- [ ] **Step 1: Create the component file**

Path: `features/classroom/components/StudentScoreItem.tsx`

```tsx
import { memo, useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Button, Card, Input } from "heroui-native";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { AttachmentThumbnailImage } from "@/features/attachments/components/AttachmentThumbnailImage";
import { useCamera } from "@/features/camera/useCamera";
import { useImagePicker } from "@/features/classroom/useImagePicker";
import { saveAttachment } from "@/features/classroom/ classroom.service";
import { useImage } from "@/providers/ImageProvider";
import { ImageSourceSheet } from "./ImageSourceSheet";

export type RowImage = { uri: string; dirty: boolean };

type Student = {
  studentId: number;
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    studentPhoto?: string | null;
  } | null;
};

type Props = {
  student: Student;
  maxScore: number;
  score: string;
  isSaved: boolean;
  image: RowImage | undefined;
  onScoreChange: (studentId: number, value: string) => void;
  onImageChange: (studentId: number, image: RowImage | null) => void;
};

const isLocalUri = (uri: string) => uri.startsWith("file://");

const StudentScoreItemBase = ({
  student,
  maxScore,
  score,
  isSaved,
  image,
  onScoreChange,
  onImageChange,
}: Props) => {
  const [showSheet, setShowSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const { showImage } = useImage();

  const {
    cameraRef,
    facing,
    flash,
    ensurePermission: ensureCameraPermission,
    takePicture,
    toggleFacing,
    toggleFlash,
    resetPhoto,
  } = useCamera();

  const { pick: pickFromLibrary } = useImagePicker();

  const fullName = student.profile
    ? `${student.profile.lastName ?? ""}, ${student.profile.firstName ?? ""}`.trim()
    : `Student ${student.studentId}`;

  const handleChangeText = useCallback(
    (text: string) => {
      if (text !== "" && !/^\d+$/.test(text)) return;
      onScoreChange(student.studentId, text);
    },
    [onScoreChange, student.studentId],
  );

  const persistAndAttach = useCallback(
    async (uri: string) => {
      try {
        const persistent = await saveAttachment(uri);
        onImageChange(student.studentId, { uri: persistent, dirty: true });
      } catch (err) {
        console.error("[StudentScoreItem] saveAttachment failed:", err);
        Alert.alert("Failed to save image", "Please try again.");
      }
    },
    [onImageChange, student.studentId],
  );

  const handlePickCamera = useCallback(async () => {
    const granted = await ensureCameraPermission();
    if (granted) setShowCamera(true);
  }, [ensureCameraPermission]);

  const handlePickLibrary = useCallback(async () => {
    const picked = await pickFromLibrary();
    if (picked) {
      await persistAndAttach(picked.uri);
    }
  }, [pickFromLibrary, persistAndAttach]);

  const handleCapture = useCallback(async () => {
    const photo = await takePicture();
    if (photo) {
      resetPhoto();
      setShowCamera(false);
      await persistAndAttach(photo.uri);
    }
  }, [takePicture, resetPhoto, persistAndAttach]);

  const handleDeleteImage = useCallback(() => {
    onImageChange(student.studentId, null);
  }, [onImageChange, student.studentId]);

  const handleThumbnailPress = useCallback(() => {
    if (!image?.uri) return;
    showImage(image.uri);
  }, [image?.uri, showImage]);

  const isOverMax = score !== "" && parseInt(score, 10) > maxScore;

  return (
    <Card className="rounded-xl items-center gap-3 mb-1.5 shadow-none flex-row">
      <Avatar alt={fullName} size="sm">
        <AttachmentAvatarImage path={student.profile?.studentPhoto} />
        <Avatar.Fallback>
          {student.profile?.firstName?.[0] ?? ""}
          {student.profile?.lastName?.[0] ?? ""}
        </Avatar.Fallback>
      </Avatar>

      <AppText className="flex-1 text-sm" numberOfLines={1}>
        {fullName}
      </AppText>

      <View className="flex-row items-center gap-1.5">
        <View className="flex-row items-center">
          <Input
            placeholder="0"
            value={score}
            onChangeText={handleChangeText}
            keyboardType="numeric"
            className={`w-14 text-center bg-accent-foreground ${
              isOverMax ? "border-red-500" : "border-gray-300"
            }`}
          />
          <AppText className="text-xs text-muted-foreground ml-1">
            /{maxScore}
          </AppText>
        </View>

        {isSaved && <Icon name="CheckCircle" size={16} color="#22c55e" />}

        {image?.uri ? (
          <View style={styles.thumbnailWrapper}>
            <Pressable onPress={handleThumbnailPress}>
              {isLocalUri(image.uri) ? (
                <Image
                  source={{ uri: image.uri }}
                  style={styles.thumbnail}
                  contentFit="cover"
                />
              ) : (
                <AttachmentThumbnailImage path={image.uri} size={40} />
              )}
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={handleDeleteImage}
              hitSlop={6}
            >
              <Icon name="X" size={10} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Button
            isIconOnly
            variant="secondary"
            className="rounded-xl"
            onPress={() => setShowSheet(true)}
          >
            <Icon name="Camera" />
          </Button>
        )}
      </View>

      <ImageSourceSheet
        isOpen={showSheet}
        onOpenChange={setShowSheet}
        onPickCamera={handlePickCamera}
        onPickLibrary={handlePickLibrary}
      />

      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
          />
          <SafeAreaView style={styles.cameraOverlay}>
            <View style={styles.cameraTopBar}>
              <Pressable
                style={styles.cameraIconButton}
                onPress={() => setShowCamera(false)}
              >
                <Icon name="X" size={24} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.cameraIconButton}
                onPress={toggleFlash}
              >
                <Icon
                  name={flash === "on" ? "Lightning" : "LightningSlash"}
                  size={24}
                  color="#fff"
                />
              </Pressable>
            </View>

            <View style={styles.cameraBottomBar}>
              <View style={styles.cameraSpacer} />
              <Pressable style={styles.captureButton} onPress={handleCapture}>
                <View style={styles.captureInner} />
              </Pressable>
              <View style={styles.cameraSpacer}>
                <Pressable
                  style={styles.cameraIconButton}
                  onPress={toggleFacing}
                >
                  <Icon name="CameraRotate" size={28} color="#fff" />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </Card>
  );
};

export const StudentScoreItem = memo(StudentScoreItemBase);
StudentScoreItem.displayName = "StudentScoreItem";

const styles = StyleSheet.create({
  thumbnailWrapper: {
    position: "relative",
    width: 40,
    height: 40,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  deleteButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  cameraTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cameraBottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  cameraSpacer: {
    flex: 1,
    alignItems: "center",
  },
  cameraIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
});

export default StudentScoreItem;
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

If the icon names (`Camera`, `CameraRotate`, `Lightning`, `LightningSlash`, `X`, `ImageSquare`, `ImageBroken`, `CheckCircle`) error out as invalid `IconName` values, check `phosphor-react-native`'s exports and use the suffixed variant (e.g. `XIcon`, `LightningIcon`) — the existing codebase mixes both conventions (`Icon name="XIcon"` appears in `StudentScoringList.tsx:399`, while `Icon name="MagnifyingGlass"` appears at `:234`). Match whichever form typechecks against the project's `IconName` union.

- [ ] **Step 3: Commit (user runs manually)**

```bash
git add features/classroom/components/StudentScoreItem.tsx
git commit -m "feat(classroom): add StudentScoreItem row with image attachment"
```

---

## Task 5: Integrate into `StudentScoringList`

**Files:**
- Modify: `features/classroom/components/StudentScoringList.tsx`

Changes:
1. Add `imagesByStudent` state + hydration from `existingScores`.
2. Extend `dirtyStudentIds` to mark rows dirty when their image changes.
3. Extend `handleSubmitAll` to pass `file` and clear image dirty flags after save.
4. Replace inline FlashList renderItem with `<StudentScoreItem />`.
5. Delete dead-code `StudentScoreItem` block (lines 309-497) and now-unused styles + imports.

- [ ] **Step 1: Replace the imports block**

In `features/classroom/components/StudentScoringList.tsx`, locate the imports block at the top of the file and replace it.

Old (lines 1-36):

```tsx
import {
  View,
  Text,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalSearchParams, useNavigation } from "expo-router";
import {
  useClassroomStudents,
  useStudentScoresForActivity,
} from "@/features/classroom/classroom.hooks";
import {
  upsertStudentScore,
  saveAttachment,
} from "@/features/classroom/ classroom.service";
import { FlashList } from "@shopify/flash-list";
import { AppText } from "@/components/AppText";
import {
  Avatar,
  Button,
  Card,
  Input,
  InputGroup,
  Skeleton,
} from "heroui-native";
import { Icon } from "@/components/Icon";
import ErrorFallback from "@/components/ErrorFallback";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import Image from "@/components/Image";
import { useCamera } from "@/features/camera/useCamera";
import type { CapturedPhoto } from "@/features/camera/useCamera";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
```

New:

```tsx
import { View, ActivityIndicator, Pressable } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalSearchParams, useNavigation } from "expo-router";
import {
  useClassroomStudents,
  useStudentScoresForActivity,
} from "@/features/classroom/classroom.hooks";
import { upsertStudentScore } from "@/features/classroom/ classroom.service";
import { FlashList } from "@shopify/flash-list";
import { AppText } from "@/components/AppText";
import { Button, Card, Input, InputGroup, Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import ErrorFallback from "@/components/ErrorFallback";
import {
  StudentScoreItem,
  type RowImage,
} from "./StudentScoreItem";
```

- [ ] **Step 2: Add `imagesByStudent` state + hydration**

Locate the `localScores` / `setLocalScores` declarations (currently around `:76-78`). Right after the `searchQuery` line, add new state:

Replace this block (currently lines 76-79):

```tsx
  const [localScores, setLocalScores] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultScore, setDefaultScore] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
```

With:

```tsx
  const [localScores, setLocalScores] = useState<Record<number, string>>({});
  const [imagesByStudent, setImagesByStudent] = useState<
    Record<number, RowImage>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultScore, setDefaultScore] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
```

- [ ] **Step 3: Extend the hydration effect to seed `imagesByStudent`**

Locate the existing hydration effect around `:81-94`:

```tsx
  useEffect(() => {
    if (existingScores) {
      setLocalScores((prev) => {
        const next = { ...prev };
        for (const score of existingScores) {
          if (next[score.studentId] === undefined) {
            next[score.studentId] =
              score.totalScore != null ? score.totalScore.toString() : "";
          }
        }
        return next;
      });
    }
  }, [existingScores]);
```

Replace with:

```tsx
  useEffect(() => {
    if (existingScores) {
      setLocalScores((prev) => {
        const next = { ...prev };
        for (const score of existingScores) {
          if (next[score.studentId] === undefined) {
            next[score.studentId] =
              score.totalScore != null ? score.totalScore.toString() : "";
          }
        }
        return next;
      });
      setImagesByStudent((prev) => {
        const next = { ...prev };
        for (const score of existingScores) {
          if (next[score.studentId] === undefined && score.file) {
            next[score.studentId] = { uri: score.file, dirty: false };
          }
        }
        return next;
      });
    }
  }, [existingScores]);
```

- [ ] **Step 4: Add `handleImageChange` callback**

Right after `handleScoreChange` (currently around `:96-98`):

```tsx
  const handleScoreChange = useCallback((studentId: number, value: string) => {
    setLocalScores((prev) => ({ ...prev, [studentId]: value }));
  }, []);
```

Append:

```tsx
  const handleImageChange = useCallback(
    (studentId: number, image: RowImage | null) => {
      setImagesByStudent((prev) => {
        if (image === null) {
          return { ...prev, [studentId]: { uri: "", dirty: true } };
        }
        return { ...prev, [studentId]: image };
      });
    },
    [],
  );
```

- [ ] **Step 5: Extend `dirtyStudentIds` to include image dirtiness**

Locate the `dirtyStudentIds` useMemo (currently `:123-142`):

```tsx
  const dirtyStudentIds = useMemo(() => {
    if (!validStudents.length) return new Set<number>();
    const dirty = new Set<number>();
    for (const s of validStudents) {
      const local = localScores[s.studentId];
      if (local === undefined || local === "") continue;
      const numericScore = parseInt(local, 10);
      if (
        isNaN(numericScore) ||
        numericScore < 0 ||
        numericScore > activityDetail.maxScore
      )
        continue;
      const saved = scoresMap[s.studentId];
      if (saved === undefined || saved !== numericScore) {
        dirty.add(s.studentId);
      }
    }
    return dirty;
  }, [validStudents, localScores, scoresMap, activityDetail.maxScore]);
```

Replace with:

```tsx
  const dirtyStudentIds = useMemo(() => {
    if (!validStudents.length) return new Set<number>();
    const dirty = new Set<number>();
    for (const s of validStudents) {
      const local = localScores[s.studentId];
      const imageDirty = imagesByStudent[s.studentId]?.dirty === true;

      if (local === undefined || local === "") continue;
      const numericScore = parseInt(local, 10);
      if (
        isNaN(numericScore) ||
        numericScore < 0 ||
        numericScore > activityDetail.maxScore
      )
        continue;

      const saved = scoresMap[s.studentId];
      const scoreChanged = saved === undefined || saved !== numericScore;

      if (scoreChanged || imageDirty) {
        dirty.add(s.studentId);
      }
    }
    return dirty;
  }, [
    validStudents,
    localScores,
    scoresMap,
    activityDetail.maxScore,
    imagesByStudent,
  ]);
```

> Note: This requires a valid score to save (existing constraint — `total_score NOT NULL`). A row with an image but no valid score will not be in `dirtyStudentIds`. This is intentional per the spec.

- [ ] **Step 6: Extend `handleSubmitAll` to pass `file` + clear dirty after save**

Locate `handleSubmitAll` (currently `:146-167`):

```tsx
  const handleSubmitAll = useCallback(async () => {
    if (dirtyStudentIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const entries = Array.from(dirtyStudentIds).map((studentId) => ({
        studentId,
        activityId: activityDetail.id,
        termId: activityDetail.termId,
        activityLocalId: activityDetail.localId,
        subjectId: activityDetail.subjectId,
        totalScore: parseInt(localScores[studentId], 10),
      }));
      console.log("[handleSubmitAll] saving:", JSON.stringify(entries));
      const promises = entries.map((entry) => upsertStudentScore(entry));
      await Promise.all(promises);
      console.log("[handleSubmitAll] save complete");
    } catch (err) {
      console.error("[StudentScoringList] Failed to save scores:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [dirtyStudentIds, localScores, activityDetail]);
```

Replace with:

```tsx
  const handleSubmitAll = useCallback(async () => {
    if (dirtyStudentIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const dirtyIds = Array.from(dirtyStudentIds);
      const entries = dirtyIds.map((studentId) => ({
        studentId,
        activityId: activityDetail.id,
        termId: activityDetail.termId,
        activityLocalId: activityDetail.localId,
        subjectId: activityDetail.subjectId,
        totalScore: parseInt(localScores[studentId], 10),
        file: imagesByStudent[studentId]?.uri || null,
      }));
      console.log("[handleSubmitAll] saving:", JSON.stringify(entries));
      const promises = entries.map((entry) => upsertStudentScore(entry));
      await Promise.all(promises);
      console.log("[handleSubmitAll] save complete");

      setImagesByStudent((prev) => {
        const next = { ...prev };
        for (const id of dirtyIds) {
          const current = next[id];
          if (current) next[id] = { ...current, dirty: false };
        }
        return next;
      });
    } catch (err) {
      console.error("[StudentScoringList] Failed to save scores:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [dirtyStudentIds, localScores, imagesByStudent, activityDetail]);
```

- [ ] **Step 7: Replace the FlashList `renderItem` with `<StudentScoreItem />`**

Locate the FlashList renderItem (currently `:255-301`):

```tsx
        renderItem={({ item }) => {
          const profile = item.profile;
          const fullName = profile
            ? `${profile.lastName}, ${profile.firstName}`
            : `Student ${item.studentId}`;
          const score = localScores[item.studentId] ?? "";
          const isOverMax =
            score !== "" && parseInt(score, 10) > activityDetail.maxScore;
          const isSaved =
            scoresMap[item.studentId] !== undefined &&
            !dirtyStudentIds.has(item.studentId);

          return (
            <Card className="rounded-xl items-center gap-3 mb-1.5 shadow-none flex-row">
              <Avatar alt={fullName} size="sm">
                <AttachmentAvatarImage path={profile?.studentPhoto} />
                <Avatar.Fallback>
                  {profile?.firstName?.[0] ?? ""}
                  {profile?.lastName?.[0] ?? ""}
                </Avatar.Fallback>
              </Avatar>
              <AppText className="flex-1 text-sm" numberOfLines={1}>
                {fullName}
              </AppText>
              <View className="flex-row items-center gap-1.5">
                <View className="flex-row items-center">
                  <Input
                    placeholder="0"
                    value={score}
                    onChangeText={(text: string) => {
                      if (text !== "" && !/^\d+$/.test(text)) return;
                      handleScoreChange(item.studentId, text);
                    }}
                    keyboardType="numeric"
                    className={`w-14 text-center bg-accent-foreground ${isOverMax ? "border-red-500" : "border-gray-300"}`}
                  />
                  <AppText className="text-xs text-muted-foreground ml-1">
                    /{activityDetail.maxScore}
                  </AppText>
                </View>
                {isSaved && (
                  <Icon name="CheckCircle" size={16} color="#22c55e" />
                )}
              </View>
            </Card>
          );
        }}
        keyExtractor={(item) => item.studentId.toString()}
        extraData={{ localScores }}
```

Replace with:

```tsx
        renderItem={({ item }) => {
          const score = localScores[item.studentId] ?? "";
          const isSaved =
            scoresMap[item.studentId] !== undefined &&
            !dirtyStudentIds.has(item.studentId);
          const image = imagesByStudent[item.studentId];

          return (
            <StudentScoreItem
              student={item}
              maxScore={activityDetail.maxScore}
              score={score}
              isSaved={isSaved}
              image={image?.uri ? image : undefined}
              onScoreChange={handleScoreChange}
              onImageChange={handleImageChange}
            />
          );
        }}
        keyExtractor={(item) => item.studentId.toString()}
        extraData={{ localScores, imagesByStudent, dirtyStudentIds }}
```

- [ ] **Step 8: Delete the dead-code `StudentScoreItem` block**

Delete the entire block from line ~309 to the end of the StyleSheet block (the dead `StudentScoreItem = React.memo(...)`, its `displayName`, and the `styles = StyleSheet.create({...})` immediately after it — everything from `const StudentScoreItem = React.memo(` through the closing `});` of `StyleSheet.create`).

The `StudentScoringSkeleton` and `export default StudentScoringList;` must remain.

Open the file and visually confirm: after deletion, the file ends with:

```tsx
const StudentScoringSkeleton = () => (
  /* ...unchanged... */
);

export default StudentScoringList;
```

- [ ] **Step 9: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS. If `React.memo` or `React` import is now unused, biome lint will flag it on next lint — already handled by removing `import React` since hooks are imported directly.

- [ ] **Step 10: Run biome (lint + format)**

Run: `pnpm lint`
Expected: PASS. If unused imports remain (e.g. `Avatar`, `Image`, `CameraView`, `useCamera`, `CapturedPhoto`, `AttachmentAvatarImage`, `StyleSheet`, `Text`, `Modal`, `SafeAreaView`, `saveAttachment`), remove them now.

- [ ] **Step 11: Commit (user runs manually)**

```bash
git add features/classroom/components/StudentScoringList.tsx
git commit -m "feat(classroom): wire image attachment into student scoring list"
```

---

## Task 6: Manual end-to-end verification

**Files:** none modified — this task runs the app and validates each scenario from the spec.

- [ ] **Step 1: Start the dev client**

Run: `pnpm start` (then launch on iOS sim, Android emulator, or device per project convention).

- [ ] **Step 2: Navigate to InputGradeScreen**

Sign in → enter a classroom → tap an activity → InputGradeScreen renders the student list with score inputs.

- [ ] **Step 3: Run the smoke scenarios**

Tick each as you verify:

- [ ] Tap the camera button on a row → action sheet appears with "Take Photo" and "Choose from Library".
- [ ] Tap "Take Photo" → camera modal opens → snap a photo → modal closes → 40×40 thumbnail appears in the rightmost slot. Score input remains editable.
- [ ] Tap the same camera button on a different row → choose "Choose from Library" → photo picker opens → select an image → thumbnail appears.
- [ ] Tap a thumbnail → full-screen view opens (via `ImageProvider`) → pinch-zoom works → tap × (or backdrop) to close.
- [ ] Tap the small × on a thumbnail → thumbnail clears and the camera button returns. Save indicator state reflects dirty status correctly.
- [ ] Enter a score on a row with no prior data + attach an image → tap "Save" in the header → wait for spinner → row shows ✓ saved icon.
- [ ] Force-quit the app and reopen → navigate back to the same InputGradeScreen → the row's thumbnail re-renders (initially via `AttachmentThumbnailImage` skeleton, then synced image).
- [ ] On a row that already has a saved score (no score edits), attach a new image → header "Save" enables → save succeeds → after PowerSync upload, the new image is what's rendered.
- [ ] In OS Settings, deny camera permission for the app → tap camera button → choose Take Photo → Alert appears with "Open Settings" option. Repeat for photo-library permission.
- [ ] Attach an image on a row whose score input is empty → header "Save" does NOT enable for that row (it stays disabled unless another row is dirty).

- [ ] **Step 4: Report any failing scenario**

If any scenario fails, capture the console output, the screenshot, and stop here. Do not commit a "Manual verification complete" marker until all scenarios pass.

- [ ] **Step 5: Final commit (user runs manually, optional)**

If all scenarios pass and the user wants a marker commit:

```bash
git commit --allow-empty -m "test(classroom): manual verification of InputGradeScreen image attach"
```

(Or skip — the feature commits in Tasks 1-5 are sufficient.)

---

## Self-Review Notes

**Spec coverage:**
- Architecture (4 new files, 1 modified) → Tasks 1–5. ✓
- Reuse list (`useCamera`, `useImage`, `saveAttachment`, `upsertStudentScore`, `useAttachment`, heroui-native `BottomSheet`) → Tasks 3, 4. ✓
- Data flow (state shape, attach/view/save, hydration) → Task 4 (component-internal), Task 5 (state + hydration + save). ✓
- Score-required constraint → Task 5 step 5 (dirty calc requires valid score). ✓
- Row layout → Task 4 (Card layout with conditional thumbnail/button slot). ✓
- Component prop signatures → Tasks 3, 4 match the spec. ✓
- Error handling (perm denied, picker cancel, saveAttachment fail, hydrated remote pending/failed) → Task 1 (gallery perm), Task 2 (pending/failed states), Task 4 (saveAttachment error Alert, camera perm via `useCamera`). ✓
- Manual test list → Task 6. ✓

**Known follow-ups (out of scope for this plan):**
- The `classroom.service.ts` file has a stray space in its path (`features/classroom/ classroom.service.ts`). Not fixed here — it's pre-existing and out of scope. The import in `StudentScoreItem.tsx` preserves the existing path.
