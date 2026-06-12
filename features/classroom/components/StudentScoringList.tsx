import {
  Keyboard,
  TextInput,
  View,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGlobalSearchParams, useNavigation } from "expo-router";
import {
  useClassroomStudents,
  useStudentScoresForActivity,
} from "@/features/classroom/classroom.hooks";
import { upsertStudentScore } from "@/features/classroom/ classroom.service";
import type { FlashListRef } from "@shopify/flash-list";
import { ScreenList } from "@/components/ScreenList";
import { AppText } from "@/components/AppText";
import { Skeleton } from "heroui-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import ErrorFallback from "@/components/ErrorFallback";
import Fallback from "@/components/Fallback";
import { useImage } from "@/providers/ImageProvider";
import { StudentScoreItem, type RowImage } from "./StudentScoreItem";
import { ApplyScoreToAllSheet } from "./ApplyScoreToAllSheet";
import { GradingProgressBar } from "./GradingProgressBar";
import { StudentSearchBar } from "./StudentSearchBar";
import { useDirtyScores } from "../useDirtyScores";
import { useImageStaging } from "../useImageStaging";

type ActivityDetail = {
  localId: string;
  maxScore: number;
  termId: number;
  subjectId: number;
  id: string;
};

const StudentScoringList = ({
  activityDetail,
}: {
  activityDetail: ActivityDetail;
}) => {
  const { classroomId } = useGlobalSearchParams();

  const {
    data: students,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useClassroomStudents(classroomId as string);

  const { data: existingScores } = useStudentScoresForActivity(
    activityDetail.localId,
  );

  const scoresMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (existingScores) {
      for (const score of existingScores) {
        map[score.studentId] = score.totalScore ?? 0;
      }
    }
    return map;
  }, [existingScores]);

  const [localScores, setLocalScores] = useState<Record<number, string>>({});
  const [imagesByStudent, setImagesByStudent] = useState<
    Record<number, RowImage>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showApplySheet, setShowApplySheet] = useState(false);
  const [filter, setFilter] = useState<"all" | "ungraded">("all");

  const { showImage } = useImage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<FlashListRef<any>>(null);

  useEffect(() => {
    if (!existingScores) return;
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
  }, [existingScores]);

  const handleScoreChange = useCallback((studentId: number, value: string) => {
    setLocalScores((prev) => ({ ...prev, [studentId]: value }));
  }, []);

  // When a row's score input gains focus, scroll the list so the active row
  // sits ~30% from the top of the visible area — comfortably above the keyboard
  // without ripping focus from the input.
  const displayStudentsRef = useRef<{ studentId: number }[]>([]);
  const handleScoreFocus = useCallback((studentId: number) => {
    const index = displayStudentsRef.current.findIndex(
      (s) => s.studentId === studentId,
    );
    if (index < 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.3,
      });
    });
  }, []);

  // Map of studentId → TextInput. Rows register their input on mount so the
  // keyboard's submit key (or external "next" trigger) can advance focus.
  const inputRefsMap = useRef<Map<number, TextInput>>(new Map());
  const registerInputRef = useCallback(
    (studentId: number, ref: TextInput | null) => {
      if (ref) inputRefsMap.current.set(studentId, ref);
      else inputRefsMap.current.delete(studentId);
    },
    [],
  );

  const handleScoreNext = useCallback((studentId: number) => {
    const list = displayStudentsRef.current;
    const idx = list.findIndex((s) => s.studentId === studentId);
    if (idx < 0 || idx >= list.length - 1) {
      // Last row (or row not found) — dismiss the keyboard.
      Keyboard.dismiss();
      return;
    }
    const nextId = list[idx + 1].studentId;
    const nextInput = inputRefsMap.current.get(nextId);
    nextInput?.focus();
  }, []);

  const handleAttach = useCallback(
    (studentId: number, persistentUri: string) => {
      setImagesByStudent((prev) => ({
        ...prev,
        [studentId]: { uri: persistentUri, dirty: true },
      }));
    },
    [],
  );

  const handleDeleteImage = useCallback((studentId: number) => {
    setImagesByStudent((prev) => ({
      ...prev,
      [studentId]: { uri: "", dirty: true },
    }));
  }, []);

  const { requestAttach, portal: imageStagingPortal } = useImageStaging({
    onAttach: handleAttach,
  });

  const validStudents = useMemo(
    () =>
      (students?.filter((s) => s.studentId != null) ?? []).sort((a, b) => {
        const lastA = a.profile?.lastName?.toLowerCase() ?? "";
        const lastB = b.profile?.lastName?.toLowerCase() ?? "";
        return lastA.localeCompare(lastB);
      }),
    [students],
  );

  const displayStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byFilter =
      filter === "ungraded"
        ? validStudents.filter((s) => scoresMap[s.studentId] === undefined)
        : validStudents;
    if (!q) return byFilter;
    return byFilter.filter((s) => {
      const name = s.profile
        ? `${s.profile.lastName} ${s.profile.firstName}`.toLowerCase()
        : "";
      return name.includes(q);
    });
  }, [validStudents, searchQuery, filter, scoresMap]);

  const ungradedCount = useMemo(
    () =>
      validStudents.filter((s) => scoresMap[s.studentId] === undefined).length,
    [validStudents, scoresMap],
  );

  // Keep a ref in sync with displayStudents so handleScoreFocus (a stable
  // callback) can read the current ordering without resubscribing every render.
  displayStudentsRef.current = displayStudents;

  const handleApplyDefault = useCallback(
    (score: string, { skipGraded }: { skipGraded: boolean }) => {
      setLocalScores((prev) => {
        const next = { ...prev };
        for (const s of validStudents) {
          // Honor the "skip already-graded" toggle so the sheet's
          // default behavior doesn't accidentally wipe scores the
          // teacher has already entered manually.
          if (skipGraded && scoresMap[s.studentId] !== undefined) continue;
          next[s.studentId] = score;
        }
        return next;
      });
    },
    [validStudents, scoresMap],
  );

  const { dirtyStudentIds, hasUnsavedChanges } = useDirtyScores({
    students: validStudents,
    localScores,
    imagesByStudent,
    scoresMap,
    maxScore: activityDetail.maxScore,
  });

  const gradedCount = useMemo(() => {
    let count = 0;
    for (const s of validStudents) {
      if (scoresMap[s.studentId] !== undefined) count++;
    }
    return count;
  }, [validStudents, scoresMap]);

  const handleSubmitAll = useCallback(async () => {
    if (dirtyStudentIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const dirtyIds = Array.from(dirtyStudentIds);
      const entries = dirtyIds.map((studentId) => {
        const local = localScores[studentId];
        const hasLocal = local !== undefined && local !== "";
        const totalScore = hasLocal
          ? parseInt(local, 10)
          : scoresMap[studentId];
        const imgState = imagesByStudent[studentId];
        // Only include `file` when the image actually changed in this session.
        // Otherwise omit so upsertStudentScore leaves the column untouched and
        // we don't re-queue an upload of the same URI.
        const file = imgState?.dirty ? imgState.uri || null : undefined;
        return {
          studentId,
          activityId: activityDetail.id,
          termId: activityDetail.termId,
          activityLocalId: activityDetail.localId,
          subjectId: activityDetail.subjectId,
          totalScore,
          file,
        };
      });
      await Promise.all(entries.map((entry) => upsertStudentScore(entry)));

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
  }, [
    dirtyStudentIds,
    localScores,
    imagesByStudent,
    activityDetail,
    scoresMap,
  ]);

  const parentNavigation = useNavigation("/(main)/classroom/[classroomId]");

  // Both action buttons live in the header (Apply all + Save). The
  // Apply-all button used to sit next to the progress bar mid-screen,
  // but it was easy to scroll past while grading; keeping both
  // ungraded-friendly actions at the top means they're reachable at
  // any scroll position.
  useEffect(() => {
    parentNavigation.setOptions({
      headerRight: () => (
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setShowApplySheet(true)}
            hitSlop={6}
            className="px-3 py-1.5 rounded-full bg-default border border-border active:opacity-70"
          >
            <AppText weight="semibold" className="text-foreground text-sm">
              Apply all
            </AppText>
          </Pressable>
          <Pressable
            onPress={handleSubmitAll}
            disabled={isSubmitting || !hasUnsavedChanges}
            style={{ opacity: isSubmitting || !hasUnsavedChanges ? 0.4 : 1 }}
            className={
              hasUnsavedChanges
                ? "px-3 py-1.5 rounded-full bg-accent"
                : "px-3 py-1.5"
            }
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" />
            ) : (
              <AppText
                weight="semibold"
                className={
                  hasUnsavedChanges
                    ? "text-accent-foreground text-sm"
                    : "text-foreground/70 text-sm"
                }
              >
                Save
              </AppText>
            )}
          </Pressable>
        </View>
      ),
    });
  }, [parentNavigation, handleSubmitAll, isSubmitting, hasUnsavedChanges]);

  // Skeleton during the initial fetch AND during a retry from the
  // error state — see features/classroom/components/LessonList for the
  // full rationale.
  if (isLoading || (isFetching && !students?.length))
    return <StudentScoringSkeleton />;

  if (isError)
    return (
      <View className="flex-1 px-2.5 pt-2.5">
        <ErrorFallback
          message={error?.message ?? "Failed to load students"}
          onRefetch={refetch}
        />
      </View>
    );

  const isSearchEmpty =
    searchQuery.trim().length > 0 && displayStudents.length === 0;

  return (
    <View className="flex-1">
      <View className="px-2.5 pt-2.5">
        <GradingProgressBar
          graded={gradedCount}
          total={validStudents.length}
        />
        {/* Filter chips — quick toggle between the full roster and the
            ungraded subset so a teacher can blast through the
            remaining rows without scrolling past already-graded ones. */}
        <View className="flex-row gap-2 mb-2 px-1">
          <FilterChip
            label="All"
            count={validStudents.length}
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <FilterChip
            label="Ungraded"
            count={ungradedCount}
            active={filter === "ungraded"}
            onPress={() => setFilter("ungraded")}
          />
        </View>
        {validStudents.length >= 10 && (
          <StudentSearchBar value={searchQuery} onChange={setSearchQuery} />
        )}
      </View>

      {isSearchEmpty ? (
        <View className="flex-1 -mt-8">
          <Fallback
            variant="empty"
            icon="MagnifyingGlassIcon"
            title={`No students match “${searchQuery.trim()}”`}
            description="Try a different search term."
            action={{
              label: "Clear search",
              onPress: () => setSearchQuery(""),
            }}
          />
        </View>
      ) : (
        // KeyboardAvoidingView shrinks the list's visible area when the
        // keyboard appears, so scrollToIndex has somewhere to bring the
        // end-of-list rows into view above the keyboard.
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScreenList
            ref={listRef}
            className=" w-full"
            data={displayStudents}
            // Extra tail space so scrollToIndex can position the last rows
            // ~30% from the top of the viewport instead of hitting the
            // content's natural bottom edge.
            contentContainerStyle={{
              paddingBottom: 320,
              paddingHorizontal: 10,
            }}
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
                  onScoreFocus={handleScoreFocus}
                  onScoreNext={handleScoreNext}
                  registerInputRef={registerInputRef}
                  onRequestAttach={requestAttach}
                  onDelete={handleDeleteImage}
                  onThumbnailPress={showImage}
                />
              );
            }}
            keyExtractor={(item) => item.studentId.toString()}
            extraData={{ localScores, imagesByStudent, dirtyStudentIds }}
          />
        </KeyboardAvoidingView>
      )}

      {imageStagingPortal}
      <ApplyScoreToAllSheet
        isOpen={showApplySheet}
        onOpenChange={setShowApplySheet}
        maxScore={activityDetail.maxScore}
        totalStudents={validStudents.length}
        ungradedCount={ungradedCount}
        onApply={handleApplyDefault}
      />
    </View>
  );
};

const FilterChip = ({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${label}, ${count} students`}
    accessibilityState={{ selected: active }}
    android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
    className={`px-3 py-1 rounded-full active:opacity-80 ${
      active ? "bg-accent" : "bg-default border border-border"
    }`}
  >
    <AppText
      weight="semibold"
      className={`text-xs ${active ? "text-accent-foreground" : "text-foreground"}`}
    >
      {label} · {count}
    </AppText>
  </Pressable>
);

export const StudentScoringSkeleton = () => (
  <View className="flex-1 px-2.5 pt-2.5">
    <View className="max-w-3xl w-full mx-auto gap-2">
      {/* Progress block */}
      <View className="mb-1 px-1">
        <Skeleton className="h-3 w-32 rounded-full mb-1.5" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </View>
      {/* Filter chips */}
      <View className="flex-row gap-2 mb-1 px-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </View>
      {/* Search bar */}
      <Skeleton className="h-10 w-full rounded-xl mb-2" />
      {/* Single-row student cards — matches the new live row chrome */}
      {Array(6)
        .fill(0)
        .map((_, i) => (
          <View
            key={i}
            className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3"
          >
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 flex-1 rounded-full" />
            <Skeleton className="h-11 w-20 rounded-lg" />
            <Skeleton className="h-3 w-8 rounded" />
            <Skeleton className="h-11 w-11 rounded-lg" />
          </View>
        ))}
    </View>
  </View>
);

export default StudentScoringList;
