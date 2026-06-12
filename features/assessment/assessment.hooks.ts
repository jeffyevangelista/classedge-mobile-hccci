import { useQuery } from "@powersync/tanstack-react-query";
import { useQuery as usePowerSyncQuery } from "@powersync/react-native";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useMemo } from "react";
import {
  getActivityById,
  getAnswersForRetakeRecordId,
  getAssessmentAttempt,
  getAssessmentDetails,
  getAssessmentMaterials,
  getAttemptRecords,
  getChoicesForQuestionIds,
  getOngoingAttempt,
  getQuestionCount,
  getQuestionTypes,
  getQuestions,
} from "./assessment.service";

// Watch-backed: re-runs whenever the `activity_studentactivity` row for
// this student/assessment pair changes (PowerSync replication, local
// upsert). Returns the first row or null. Disabled-ish: when the inputs
// are falsy we still build the compilable query against an empty filter,
// but flatten to null in the memo — PowerSync's watch is cheap and this
// keeps the hook's identity stable.
export const useAssessmentDetails = ({
  userId,
  assessmentId,
}: {
  userId: number;
  assessmentId: string;
}) => {
  const enabled = !!assessmentId && assessmentId !== "undefined" && !!userId;
  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(
      toCompilableQuery(
        getAssessmentDetails(enabled ? assessmentId : "", enabled ? userId : 0),
      ),
    );
  const data = useMemo(
    () => (enabled ? rows?.[0] ?? null : null),
    [rows, enabled],
  );
  return {
    data,
    isLoading: enabled ? isLoading : false,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed: re-runs whenever the student's `activity_retakerecord`
// rows for this studentActivity change (new attempt, status flip, server
// fills in `score` + `graded_at`, etc.).
export const useAttemptRecords = (
  studentActivityId: string,
  studentId: number,
) => {
  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(
      toCompilableQuery(getAttemptRecords(studentActivityId, studentId)),
    );
  const data = useMemo(() => rows ?? [], [rows]);
  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed single attempt row by localId. Re-fires on local
// mutations (heartbeat, lastIndex) and on server-side syncs (status,
// score, graded_at).
export const useGetAssessmentAttempt = (localId: string) => {
  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(toCompilableQuery(getAssessmentAttempt(localId)));
  const data = useMemo(() => rows?.[0] ?? null, [rows]);
  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed unordered question list. Kept for parity — the ordered
// variant below is what consumers actually use.
export const useGetQuestions = (activityId: string) => {
  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(toCompilableQuery(getQuestions(activityId)));
  const data = useMemo(() => rows ?? [], [rows]);
  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed: subscribes to `activity_activityquestion` for the
// activity, then sorts the rows by the attempt's stored questionOrder
// in JS. Reactive: if a question syncs in late, it'll appear here on
// the next watch tick instead of waiting for screen remount.
export const useGetOrderedQuestions = (
  activityId: string,
  questionOrder: number[],
) => {
  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(toCompilableQuery(getQuestions(activityId)));
  const data = useMemo(() => {
    if (!activityId) return undefined;
    if (rows === undefined) return undefined;
    if (!Array.isArray(questionOrder) || questionOrder.length === 0) return [];
    const byId = new Map(rows.map((q) => [String(q.id), q]));
    return questionOrder
      .map((id) => byId.get(String(id)))
      .filter((q): q is NonNullable<typeof q> => q != null);
  }, [activityId, rows, questionOrder]);
  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed: chains attempt-by-localId → answers-by-retakeRecordId.
// Reactive — freshly synced answer rows surface without remount.
// Returns `data: undefined` until the first watch frame for both legs
// resolves so the QuestionList loading guard doesn't blow away
// in-progress local state on initial render.
export const useGetAnswersForAttempt = (attemptLocalId: string) => {
  const attemptW = usePowerSyncQuery(
    toCompilableQuery(getAssessmentAttempt(attemptLocalId)),
  );
  const retakeRecordId = attemptW.data?.[0]?.id ?? "";
  const answersW = usePowerSyncQuery(
    toCompilableQuery(getAnswersForRetakeRecordId(retakeRecordId)),
  );
  const data = useMemo(() => {
    if (!attemptLocalId) return undefined;
    if (attemptW.data === undefined || answersW.data === undefined)
      return undefined;
    return answersW.data;
  }, [attemptLocalId, attemptW.data, answersW.data]);
  const isLoading = !!attemptLocalId && data === undefined;
  const isFetching = attemptW.isFetching || answersW.isFetching;
  const error = attemptW.error || answersW.error;
  const refetch = async () => {
    await Promise.all([attemptW.refresh?.(), answersW.refresh?.()]);
  };
  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch,
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed: chains questions-for-activity → choices-by-questionIds.
// New choices for a question (e.g. teacher edits the question while
// the student is in the attempt) push live instead of waiting for
// a screen remount.
export const useChoicesForActivity = (activityId: string) => {
  const questionsW = usePowerSyncQuery(
    toCompilableQuery(getQuestions(activityId)),
  );
  const questionIds = useMemo(
    () =>
      (questionsW.data ?? [])
        .map((q) => Number(q.id))
        .filter((n) => Number.isFinite(n)),
    [questionsW.data],
  );
  const choicesW = usePowerSyncQuery(
    toCompilableQuery(getChoicesForQuestionIds(questionIds)),
  );
  const data = useMemo(() => choicesW.data ?? [], [choicesW.data]);
  const isLoading =
    !!activityId &&
    (questionsW.data === undefined || choicesW.data === undefined);
  const isFetching = questionsW.isFetching || choicesW.isFetching;
  const error = questionsW.error || choicesW.error;
  const refetch = async () => {
    await Promise.all([questionsW.refresh?.(), choicesW.refresh?.()]);
  };
  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch,
    isRefetching: isFetching && !isLoading,
  };
};

export const useOngoingAttempt = (
  studentActivityId?: string,
  studentId?: number,
) => {
  return useQuery({
    queryKey: ["ongoing-attempt", studentActivityId, studentId],
    queryFn: () => getOngoingAttempt(studentActivityId!, studentId!),
    enabled: !!studentActivityId && !!studentId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useQuestionTypes = () => {
  return useQuery({
    queryKey: ["question-types"],
    queryFn: () => getQuestionTypes(),
    staleTime: 1000 * 60 * 60,
  });
};

// Watch-backed: composes five reactive watches (attempt, activity,
// questions, answers, choices) and stitches them together so the review
// screen flips from "Pending grading" to a numeric score the moment
// the server-side grade syncs in — no manual refresh needed.
export const useAttemptReview = (attemptLocalId: string | undefined) => {
  const safeLocalId = attemptLocalId ?? "";
  const attemptW = usePowerSyncQuery(
    toCompilableQuery(getAssessmentAttempt(safeLocalId)),
  );
  const attempt = attemptW.data?.[0] ?? null;

  const activityId = attempt?.activityId ?? "";
  const activityW = usePowerSyncQuery(
    toCompilableQuery(getActivityById(activityId)),
  );
  const activity = activityW.data?.[0] ?? null;

  const questionsW = usePowerSyncQuery(
    toCompilableQuery(getQuestions(activityId)),
  );
  const questions = useMemo(() => questionsW.data ?? [], [questionsW.data]);

  const retakeRecordId = attempt?.id ?? "";
  const answersW = usePowerSyncQuery(
    toCompilableQuery(getAnswersForRetakeRecordId(retakeRecordId)),
  );
  const answers = useMemo(() => answersW.data ?? [], [answersW.data]);

  // Memoize the question id list so the choices watch only resubscribes
  // when the underlying set actually changes (not on every render).
  const questionIds = useMemo(
    () =>
      questions
        .map((q) => Number(q.id))
        .filter((n) => Number.isFinite(n)),
    [questions],
  );
  const choicesW = usePowerSyncQuery(
    toCompilableQuery(getChoicesForQuestionIds(questionIds)),
  );
  const choices = useMemo(() => choicesW.data ?? [], [choicesW.data]);

  const data = useMemo(() => {
    if (!attemptLocalId) return null;
    if (!attempt) return null;
    if (!activity) {
      return {
        attempt,
        activity: null,
        questions: [],
        answers,
        choices: [],
      };
    }
    // SQLite returns question.id as a string at runtime; key the map
    // with String() so the order lookup hits.
    let order: string[] = [];
    try {
      const parsed = JSON.parse(attempt.questionOrder ?? "[]");
      if (Array.isArray(parsed)) order = parsed.map((n) => String(n));
    } catch {
      order = [];
    }
    const byId = new Map(questions.map((q) => [String(q.id), q]));
    const ordered = order
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => q != null);
    const finalQuestions =
      ordered.length > 0
        ? ordered
        : [...questions].sort((a, b) => Number(a.id) - Number(b.id));
    return {
      attempt,
      activity,
      questions: finalQuestions,
      answers,
      choices,
    };
  }, [attemptLocalId, attempt, activity, questions, answers, choices]);

  const isLoading = !!attemptLocalId && attemptW.data === undefined;
  const isFetching =
    attemptW.isFetching ||
    activityW.isFetching ||
    questionsW.isFetching ||
    answersW.isFetching ||
    choicesW.isFetching;
  const error =
    attemptW.error ||
    activityW.error ||
    questionsW.error ||
    answersW.error ||
    choicesW.error;
  const refetch = async () => {
    await Promise.all([
      attemptW.refresh?.(),
      activityW.refresh?.(),
      questionsW.refresh?.(),
      answersW.refresh?.(),
      choicesW.refresh?.(),
    ]);
  };

  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch,
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed: re-runs whenever the join table
// `activity_activity_additional_modules` or the `module_module` rows it
// joins to change. Drops join rows whose `module` hasn't synced yet so
// the UI doesn't flash empty cards while modules are still arriving.
export const useAssessmentMaterials = (activityId: string | undefined) => {
  const safeId = activityId ?? "";
  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(toCompilableQuery(getAssessmentMaterials(safeId)));
  const data = useMemo(() => {
    if (!activityId || rows === undefined) return undefined;
    return rows.filter((r) => r.module != null).map((r) => r.module!);
  }, [rows, activityId]);
  return {
    data,
    isLoading: activityId ? isLoading : false,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};

// Watch-backed: re-runs whenever rows are added/removed from
// `activity_activityquestion` for this activity. The hook reduces the
// row list to a count for the consumer. Returns `undefined` while the
// first watch frame hasn't returned (or when activityId is missing) so
// callers can render a "—" placeholder instead of a misleading 0.
export const useQuestionCount = (activityId: string | undefined) => {
  const safeId = activityId ?? "";
  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(toCompilableQuery(getQuestionCount(safeId)));
  const data = useMemo(
    () => (activityId && rows !== undefined ? rows.length : undefined),
    [rows, activityId],
  );
  return {
    data,
    isLoading: activityId ? isLoading : false,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};
