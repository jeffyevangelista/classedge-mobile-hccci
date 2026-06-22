import { Avatar, useThemeColor } from "heroui-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, type TextInput, View } from "react-native";
import AppInput from "@/components/AppInput";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { AttachmentThumbnailImage } from "@/features/attachments/components/AttachmentThumbnailImage";
import { useAttachment } from "@/features/attachments/hooks/useAttachment";
import { toTitleCase } from "@/utils/toTitleCase";
import { ImageActionSheet } from "./ImageActionSheet";

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
  onScoreFocus: (studentId: number) => void;
  onScoreNext: (studentId: number) => void;
  registerInputRef: (studentId: number, ref: TextInput | null) => void;
  onRequestAttach: (studentId: number) => void;
  onDelete: (studentId: number) => void;
  onThumbnailPress: (uri: string) => void;
};

const isLocalUri = (uri: string) => uri.startsWith("file://");

const StudentScoreItemBase = ({
  student,
  maxScore,
  score,
  isSaved,
  image,
  onScoreChange,
  onScoreFocus,
  onScoreNext,
  registerInputRef,
  onRequestAttach,
  onDelete,
  onThumbnailPress,
}: Props) => {
  const inputRef = useRef<TextInput>(null);

  // Register the input ref with the parent so it can focus this row's input
  // when the previous row presses the keyboard's submit/next key. Re-register
  // when FlashList recycles a row to a different student.
  useEffect(() => {
    registerInputRef(student.studentId, inputRef.current);
    const id = student.studentId;
    return () => registerInputRef(id, null);
  }, [student.studentId, registerInputRef]);
  const fullName = student.profile
    ? toTitleCase(
        `${student.profile.lastName ?? ""}, ${student.profile.firstName ?? ""}`.trim(),
      )
    : `Student ${student.studentId}`;

  const handleChangeText = useCallback(
    (text: string) => {
      if (text !== "" && !/^\d+$/.test(text)) return;
      onScoreChange(student.studentId, text);
    },
    [onScoreChange, student.studentId],
  );

  const handleFocus = useCallback(() => {
    onScoreFocus(student.studentId);
  }, [onScoreFocus, student.studentId]);

  const handleSubmitEditing = useCallback(() => {
    onScoreNext(student.studentId);
  }, [onScoreNext, student.studentId]);

  const handleAttachPress = useCallback(() => {
    onRequestAttach(student.studentId);
  }, [onRequestAttach, student.studentId]);

  const handleDeletePress = useCallback(() => {
    onDelete(student.studentId);
  }, [onDelete, student.studentId]);

  // After PowerSync resync, image.uri is a server-relative path; resolve via
  // useAttachment so the fullscreen overlay receives the cached local file URI
  // instead of an unloadable path.
  const isLocal = image?.uri ? isLocalUri(image.uri) : false;
  const { uri: resolvedUri } = useAttachment(
    image?.uri && !isLocal ? image.uri : null,
  );
  const fullscreenUri = isLocal ? image?.uri : resolvedUri;
  const hasImage = !!image?.uri;

  const handleThumbnailTap = useCallback(() => {
    if (!fullscreenUri) return;
    onThumbnailPress(fullscreenUri);
  }, [fullscreenUri, onThumbnailPress]);

  // Long-press opens the action sheet (View / Replace / Delete). The
  // tiny X badge stays around as a quick-delete affordance for power
  // users, but the menu is the discoverable path for replacing without
  // a two-step delete-then-attach dance.
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const handleThumbnailLongPress = useCallback(() => {
    if (!hasImage) return;
    setActionSheetOpen(true);
  }, [hasImage]);
  const handleReplace = useCallback(() => {
    onRequestAttach(student.studentId);
  }, [onRequestAttach, student.studentId]);

  const isOverMax = score !== "" && parseInt(score, 10) > maxScore;
  const mutedColor = useThemeColor("muted");

  return (
    <View className="max-w-3xl w-full mx-auto mb-1">
      <View className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3">
        {/* Left accent strip only on un-saved (dirty / ungraded) rows so
            the eye lands on the rows that still need attention. We
            don't dim saved rows because that also dims the score
            value itself — the strip alone is enough differentiation. */}
        {!isSaved ? (
          <View className="w-1 h-10 rounded-full bg-accent shrink-0" />
        ) : null}
        <Avatar alt={fullName} size="sm" className="shrink-0">
          <AttachmentAvatarImage path={student.profile?.studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>
        {/* `flex-1 min-w-0` lets the name shrink; `numberOfLines={2}` +
            `leading-tight` lets long compound names wrap to a second
            line so sibling rows (shared prefix) stay distinguishable.
            Most rows still render as a single line. */}
        <AppText
          weight="semibold"
          className="flex-1 min-w-0 text-sm leading-tight"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {fullName}
        </AppText>
        {/* Explicit border + tinted background so the input reads as a
            field rather than blending into the card surface. Bolder
            text + tabular-nums so the entered score is unambiguous. */}
        <AppInput
          ref={inputRef}
          placeholder="0"
          value={score}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onSubmitEditing={handleSubmitEditing}
          submitBehavior="submit"
          returnKeyType="next"
          keyboardType="numeric"
          maxLength={String(maxScore).length}
          className={`w-20 text-center text-base font-semibold shrink-0 bg-default border ${
            isOverMax ? "border-danger" : "border-border"
          }`}
          style={{ fontVariant: ["tabular-nums"] }}
        />
        <AppText className="text-xs text-muted shrink-0">/ {maxScore}</AppText>
        {hasImage ? (
          <View style={styles.thumbnailWrapper}>
            <Pressable
              onPress={handleThumbnailTap}
              onLongPress={handleThumbnailLongPress}
              delayLongPress={300}
              style={styles.thumbnail}
              accessibilityRole="button"
              accessibilityLabel="Attached image, tap to view, long-press for options"
            >
              {isLocal ? (
                <Image
                  source={{ uri: image!.uri }}
                  style={styles.thumbnail}
                  contentFit="cover"
                />
              ) : (
                <AttachmentThumbnailImage path={image!.uri} size={44} />
              )}
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={handleDeletePress}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Remove image"
            >
              <Icon name="XIcon" size={14} color="#fff" />
            </Pressable>
          </View>
        ) : (
          // Stronger fill + border so the camera button reads as an
          // affordance instead of disappearing into the card surface.
          <Pressable
            onPress={handleAttachPress}
            className="w-11 h-11 rounded-xl bg-default border border-border justify-center items-center shrink-0 active:opacity-70"
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Attach image"
          >
            <Icon name="Camera" size={20} color={mutedColor} />
          </Pressable>
        )}
      </View>
      <ImageActionSheet
        isOpen={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        onView={handleThumbnailTap}
        onReplace={handleReplace}
        onDelete={handleDeletePress}
      />
    </View>
  );
};

export const StudentScoreItem = memo(StudentScoreItemBase);
StudentScoreItem.displayName = "StudentScoreItem";

const styles = StyleSheet.create({
  thumbnailWrapper: {
    position: "relative",
    width: 44,
    height: 44,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  deleteButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
});

export default StudentScoreItem;
