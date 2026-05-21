import { memo, useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, type TextInput, View } from "react-native";
import { Avatar, Card, Input, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { AttachmentThumbnailImage } from "@/features/attachments/components/AttachmentThumbnailImage";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { useAttachment } from "@/features/attachments/hooks/useAttachment";
import { toTitleCase } from "@/utils/toTitleCase";

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

  const handleThumbnailTap = useCallback(() => {
    if (!fullscreenUri) return;
    onThumbnailPress(fullscreenUri);
  }, [fullscreenUri, onThumbnailPress]);

  const isOverMax = score !== "" && parseInt(score, 10) > maxScore;
  const hasImage = !!image?.uri;
  const mutedColor = useThemeColor("muted");

  return (
    <Card className=" max-w-3xl w-full  mx-auto rounded-2xl shadow-none mb-2 py-3 px-3">
      <View className="flex-row items-center gap-3 mb-2.5">
        <Avatar alt={fullName} size="sm">
          <AttachmentAvatarImage path={student.profile?.studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>
        <AppText weight="semibold" className="flex-1 text-sm" numberOfLines={1}>
          {fullName}
        </AppText>
        {isSaved && (
          <View className="flex-row items-center gap-1">
            <Icon name="CheckCircle" size={14} color="#22c55e" />
            <AppText className="text-xs text-foreground/70">Saved</AppText>
          </View>
        )}
      </View>

      <View className="flex-row items-center gap-3 pl-11">
        <View className="flex-row items-center flex-1">
          <Input
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
            className={`w-20 text-center ${isOverMax ? "border-red-500" : ""}`}
          />
          <AppText className="text-sm text-foreground/70 ml-2">
            / {maxScore}
          </AppText>
        </View>

        {hasImage ? (
          <View style={styles.thumbnailWrapper}>
            <Pressable onPress={handleThumbnailTap} style={styles.thumbnail}>
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
            >
              <Icon name="XIcon" size={14} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleAttachPress}
            className="w-11 h-11 rounded-xl bg-default-100 border border-border justify-center items-center"
            hitSlop={6}
          >
            <Icon name="Camera" size={20} color={mutedColor} />
          </Pressable>
        )}
      </View>
    </Card>
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
