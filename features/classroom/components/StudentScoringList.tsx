import {
  View,
  Text,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalSearchParams } from "expo-router";
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
import { Avatar, Button, Card, Input } from "heroui-native";
import { Icon } from "@/components/Icon";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import Image from "@/components/Image";
import { useCamera } from "@/features/camera/useCamera";
import type { CapturedPhoto } from "@/features/camera/useCamera";

type LocalImages = Record<number, CapturedPhoto | null>;

type ActivityDetail = {
  localId: string;
  maxScore: number;
  termId: number;
  subjectId: number;
  id: number;
};

const StudentScoringList = ({
  activityDetail,
}: {
  activityDetail: ActivityDetail;
}) => {
  const { classroomId } = useGlobalSearchParams();
  console.log("activityDetail ----c", activityDetail.id);

  const {
    data: students,
    isLoading,
    isError,
    error,
  } = useClassroomStudents(classroomId as string);

  const { data: existingScores } = useStudentScoresForActivity(
    activityDetail.localId,
  );

  const scoresMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (existingScores) {
      for (const score of existingScores) {
        map[score.studentId] = score.totalScore;
      }
    }
    return map;
  }, [existingScores]);

  const [localScores, setLocalScores] = useState<Record<number, string>>({});
  const [localImages, setLocalImages] = useState<LocalImages>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (existingScores) {
      setLocalScores((prev) => {
        const next = { ...prev };
        for (const score of existingScores) {
          if (next[score.studentId] === undefined) {
            next[score.studentId] = score.totalScore.toString();
          }
        }
        return next;
      });
    }
  }, [existingScores]);

  const handleScoreChange = useCallback((studentId: number, value: string) => {
    setLocalScores((prev) => ({ ...prev, [studentId]: value }));
  }, []);

  const handleImageChange = useCallback(
    (studentId: number, image: CapturedPhoto | null) => {
      setLocalImages((prev) => ({ ...prev, [studentId]: image }));
    },
    [],
  );

  const dirtyStudentIds = useMemo(() => {
    if (!students) return new Set<number>();
    const dirty = new Set<number>();
    for (const s of students) {
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
      } else if (localImages[s.studentId]) {
        dirty.add(s.studentId);
      }
    }
    return dirty;
  }, [students, localScores, localImages, scoresMap, activityDetail.maxScore]);

  const hasUnsavedChanges = dirtyStudentIds.size > 0;

  const handleSubmitAll = useCallback(async () => {
    if (dirtyStudentIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const promises = Array.from(dirtyStudentIds).map(async (studentId) => {
        let fileUri: string | null = null;
        const image = localImages[studentId];
        if (image) {
          fileUri = await saveAttachment(image.uri);
        }
        return upsertStudentScore({
          studentId,
          activityId: activityDetail.id,
          termId: activityDetail.termId,
          activityLocalId: activityDetail.localId,
          subjectId: activityDetail.subjectId,
          totalScore: parseInt(localScores[studentId], 10),
          file: fileUri,
        });
      });
      await Promise.all(promises);
      setLocalImages({});
    } catch (err) {
      console.error("[StudentScoringList] Failed to save scores:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [dirtyStudentIds, localScores, localImages, activityDetail]);

  if (isLoading) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View>
        <Text>Error: {error?.message}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlashList
        className="max-w-3xl w-full mx-auto"
        data={students}
        renderItem={({ item }) => (
          <StudentScoreItem
            studentId={item.studentId}
            activityDetail={activityDetail}
            score={localScores[item.studentId] ?? ""}
            onScoreChange={handleScoreChange}
            capturedImage={localImages[item.studentId] ?? null}
            onImageChange={handleImageChange}
            isSaved={
              scoresMap[item.studentId] !== undefined &&
              !dirtyStudentIds.has(item.studentId)
            }
          />
        )}
        keyExtractor={(item) => item.studentId.toString()}
        extraData={{ localScores, localImages }}
      />
      <View className="p-4 max-w-3xl w-full mx-auto">
        <Button
          onPress={handleSubmitAll}
          isDisabled={isSubmitting || !hasUnsavedChanges}
          className="rounded-xl"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <AppText className="text-white font-semibold">
              Submit All Scores
            </AppText>
          )}
        </Button>
      </View>
    </View>
  );
};

const StudentScoreItem = React.memo(
  ({
    studentId,
    activityDetail,
    score,
    onScoreChange,
    capturedImage,
    onImageChange,
    isSaved,
  }: {
    studentId: number;
    activityDetail: ActivityDetail;
    score: string;
    onScoreChange: (studentId: number, value: string) => void;
    capturedImage: CapturedPhoto | null;
    onImageChange: (studentId: number, image: CapturedPhoto | null) => void;
    isSaved: boolean;
  }) => {
    const [showCamera, setShowCamera] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const {
      cameraRef,
      facing,
      flash,
      ensurePermission,
      takePicture,
      toggleFacing,
      toggleFlash,
      resetPhoto,
    } = useCamera();

    const handleOpenCamera = useCallback(async () => {
      const granted = await ensurePermission();
      if (granted) {
        setShowCamera(true);
      }
    }, [ensurePermission]);

    const handleCapture = useCallback(async () => {
      const photo = await takePicture();
      if (photo) {
        onImageChange(studentId, photo);
        resetPhoto();
        setShowCamera(false);
      }
    }, [takePicture, resetPhoto, onImageChange, studentId]);

    const handleDeleteImage = useCallback(() => {
      onImageChange(studentId, null);
    }, [onImageChange, studentId]);

    const handleChangeText = (text: string) => {
      if (text !== "" && !/^\d+$/.test(text)) return;
      onScoreChange(studentId, text);
    };

    const isOverMax =
      score !== "" && parseInt(score, 10) > activityDetail.maxScore;

    return (
      <Card className="rounded-xl items-center gap-2 mb-2 shadow-none flex-row">
        <Avatar alt="user-avatar">
          <Avatar.Image />
          <Avatar.Fallback>{studentId}</Avatar.Fallback>
        </Avatar>
        <AppText className="flex-1">{studentId}</AppText>

        <View className="flex-row gap-1 items-center">
          <Input
            placeholder="Score"
            value={score}
            onChangeText={handleChangeText}
            keyboardType="numeric"
            className={`bg-accent-foreground ${isOverMax ? "border-red-500" : "border-gray-300"}`}
          />
          {isSaved && <Icon name="CheckCircle" size={18} color="#22c55e" />}
          {capturedImage ? (
            <View style={styles.thumbnailWrapper}>
              <Pressable onPress={() => setShowPreview(true)}>
                <Image
                  source={{ uri: capturedImage.uri }}
                  style={styles.thumbnail}
                  contentFit="cover"
                />
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                onPress={handleDeleteImage}
              >
                <Icon name="XIcon" size={10} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Button
              isIconOnly
              variant="secondary"
              className="rounded-xl"
              onPress={handleOpenCamera}
            >
              <Icon name="Camera" />
            </Button>
          )}
        </View>

        <Modal
          visible={showPreview}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPreview(false)}
        >
          <Pressable
            style={styles.previewOverlay}
            onPress={() => setShowPreview(false)}
          >
            <SafeAreaView style={styles.previewContainer}>
              <Pressable
                style={styles.previewCloseButton}
                onPress={() => setShowPreview(false)}
              >
                <Icon name="XIcon" size={24} color="#fff" />
              </Pressable>
              {capturedImage && (
                <Image
                  source={{ uri: capturedImage.uri }}
                  style={styles.previewImage}
                  contentFit="contain"
                />
              )}
            </SafeAreaView>
          </Pressable>
        </Modal>

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
                  <Icon name="XIcon" size={24} color="#fff" />
                </Pressable>
                <Pressable
                  style={styles.cameraIconButton}
                  onPress={toggleFlash}
                >
                  <Icon
                    name={
                      flash === "on" ? "LightningIcon" : "LightningSlashIcon"
                    }
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
                    <Icon name="CameraRotateIcon" size={28} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </Card>
    );
  },
);
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
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "90%",
    height: "80%",
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

export default StudentScoringList;
