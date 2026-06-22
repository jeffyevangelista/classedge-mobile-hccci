import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import { attemptAnswerTable, attemptsTable } from "@/powersync/schema";
import { db } from "@/powersync/system";
import { queryClient } from "@/providers/QueryProvider";

// Returns the drizzle query builder (not awaited) so the hook can wrap it
// with `toCompilableQuery` for PowerSync's watch. The hook flattens the
// `findMany` result to `rows[0] ?? null` for the consumer.
export const getAssessmentDetails = (assessmentId: string, userId: number) => {
  return db.query.studentAssessment.findMany({
    where: (studentAssessment, { and, eq }) =>
      and(
        eq(studentAssessment.activityId, assessmentId),
        eq(studentAssessment.studentId, userId),
      ),
    limit: 1,
  });
};

// Returns the drizzle query builder so the hook can wrap it for watch.
// No more console.logs here — watch ticks would flood them.
export const getAttemptRecords = (
  studentActivityId: string,
  studentId: number,
) => {
  return db.query.attemptsTable.findMany({
    where: (t, { and, eq }) =>
      and(
        eq(t.studentActivityId, studentActivityId),
        eq(t.studentId, studentId),
      ),
  });
};

export const getAssessmentAttempt = (localId: string) => {
  return db.query.attemptsTable.findFirst({
    where: (attemptsTable, { eq }) => eq(attemptsTable.localId, localId),
  });
};

export const getQuestions = (activityId: string) => {
  return db.query.assessmentQuestionTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    orderBy: (t, { asc }) => [asc(t.id)],
  });
};

// Compilable building blocks for the review screen — each returns an
// un-awaited Drizzle query the hook can wrap with `toCompilableQuery`
// for PowerSync's watch. The five-step join used to live in
// `getAttemptReviewData`, but a single async queryFn could only refresh
// on mount/focus. Splitting into watches makes the review screen react
// live to server-side grading updates.

export const getActivityById = (activityId: string) => {
  return db.query.assessmentTable.findFirst({
    where: (t, { eq }) => eq(t.id, activityId),
  });
};

export const getAnswersForRetakeRecordId = (retakeRecordId: string) => {
  return db.query.attemptAnswerTable.findMany({
    where: (t, { eq }) => eq(t.retakeRecordId, retakeRecordId),
  });
};

export const getChoicesForQuestionIds = (questionIds: number[]) => {
  // Drizzle's `inArray(col, [])` historically produced invalid SQL on
  // some adapters; using a never-matching sentinel keeps the SQL safe
  // and the watch alive while the questions list is still loading.
  const ids = questionIds.length > 0 ? questionIds : [-1];
  return db.query.assessmentQuestionsTable.findMany({
    where: (t) => inArray(t.questionId, ids),
    orderBy: (t, { asc }) => [asc(t.id)],
  });
};

// Returns the drizzle query builder (not awaited) so the hook can wrap
// it with `toCompilableQuery` for PowerSync's watch. The hook drops join
// rows whose module hasn't synced yet — the next watch tick will surface
// them when they arrive.
export const getAssessmentMaterials = (activityId: string) => {
  return db.query.assessmentAdditionalModulesJoin.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    with: { module: true },
  });
};

// Returns the drizzle query builder so the hook can wrap it for watch.
// The hook reduces `rows.length` for the consumer.
export const getQuestionCount = (activityId: string) => {
  return db.query.assessmentQuestionTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    columns: { id: true },
  });
};

export const saveAnswer = async (
  retakeRecordId: string,
  activityQuestionId: number,
  studentId: number,
  studentAnswer: string,
  uploadedFile?: string,
) => {
  const existing = await db.query.attemptAnswerTable.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.retakeRecordId, retakeRecordId),
        eq(t.activityQuestionId, activityQuestionId),
      ),
  });

  if (existing) {
    const patch: { studentAnswer: string; uploadedFile?: string } = {
      studentAnswer,
    };
    if (uploadedFile !== undefined) patch.uploadedFile = uploadedFile;
    return db
      .update(attemptAnswerTable)
      .set(patch)
      .where(eq(attemptAnswerTable.localId, existing.localId))
      .returning();
  }

  const localId = createId();
  return db
    .insert(attemptAnswerTable)
    .values({
      id: localId,
      localId,
      retakeRecordId,
      activityQuestionId,
      studentId,
      studentAnswer,
      score: 0,
      uploadedFile: uploadedFile ?? "",
    })
    .returning();
};

export const updateHeartbeat = (attemptLocalId: string) => {
  return db
    .update(attemptsTable)
    .set({ lastHeartbeatAt: new Date().toISOString() })
    .where(eq(attemptsTable.localId, attemptLocalId));
};

export const updateLastIndex = (attemptLocalId: string, lastIndex: number) => {
  return db
    .update(attemptsTable)
    .set({ lastIndex })
    .where(eq(attemptsTable.localId, attemptLocalId));
};

export const getQuestionTypes = () => {
  return db.query.questionType.findMany();
};

export const getOngoingAttempt = (
  studentActivityId: string,
  studentId: number,
) => {
  return db.query.attemptsTable.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.studentActivityId, studentActivityId),
        eq(t.studentId, studentId),
        eq(t.status, "ongoing"),
      ),
  });
};

export const finalizeAttempt = (attemptLocalId: string) => {
  return db
    .update(attemptsTable)
    .set({
      status: "submitted",
      lastHeartbeatAt: new Date().toISOString(),
    })
    .where(eq(attemptsTable.localId, attemptLocalId));
};

export const submitAttempt = async (attemptLocalId: string) => {
  await finalizeAttempt(attemptLocalId);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["retake-records"] }),
    queryClient.invalidateQueries({ queryKey: ["assessment-details"] }),
    queryClient.invalidateQueries({ queryKey: ["ongoing-attempt"] }),
    queryClient.invalidateQueries({ queryKey: ["course_timeline"] }),
  ]);
};

export const findStudentActivity = async (params: {
  activityId: string;
  termId: number;
  subjectId: number;
  studentId: number;
}) => {
  const result = await db.query.studentAssessment.findFirst({
    where: (sa, { and, eq }) =>
      and(
        eq(sa.activityId, params.activityId),
        eq(sa.termId, params.termId),
        eq(sa.subjectId, params.subjectId),
        eq(sa.studentId, params.studentId),
      ),
  });
  return result ?? null;
};

export const buildQuestionOrder = async (
  activityId: string,
  shuffle: boolean,
) => {
  const rows = await db.query.assessmentQuestionTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    orderBy: (t, { asc }) => [asc(t.id)],
  });
  const ids = rows.map((q) => q.id);
  if (!shuffle) return ids;
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
};

export const countAttempts = async (params: {
  studentActivityId: string;
  studentId: number;
  activityId: string;
}) => {
  const rows = await db.query.attemptsTable.findMany({
    where: (t, { and, eq }) =>
      and(
        eq(t.studentActivityId, params.studentActivityId),
        eq(t.studentId, params.studentId),
        eq(t.activityId, params.activityId),
      ),
  });
  return rows.length;
};

export const countCompletedAttempts = async (params: {
  studentActivityId: string;
  studentId: number;
  activityId: string;
}) => {
  const rows = await db.query.attemptsTable.findMany({
    where: (t, { and, eq }) =>
      and(
        eq(t.studentActivityId, params.studentActivityId),
        eq(t.studentId, params.studentId),
        eq(t.activityId, params.activityId),
        eq(t.status, "submitted"),
      ),
  });
  return rows.length;
};

export const createAttempt = async (params: {
  studentActivityId: string;
  studentId: number;
  activityId: string;
  retakeNumber: number;
  duration: number;
  questionOrder: number[];
}) => {
  if (__DEV__) console.log("[createAttempt] params:", params);
  const localId = createId();
  const now = new Date().toISOString();
  const willEndAt = new Date(Date.now() + params.duration * 1000).toISOString();
  try {
    const inserted = await db
      .insert(attemptsTable)
      .values({
        id: localId,
        localId,
        studentActivityId: params.studentActivityId,
        studentId: params.studentId,
        activityId: params.activityId,
        retakeNumber: params.retakeNumber,
        score: 0,
        status: "ongoing",
        startedAt: now,
        willEndAt,
        duration: params.duration,
        questionOrder: JSON.stringify(params.questionOrder),
        lastIndex: 0,
      })
      .returning();
    if (__DEV__) console.log("[createAttempt] inserted row:", inserted[0]);
    return inserted[0];
  } catch (err) {
    console.error("[createAttempt] insert failed:", err);
    throw err;
  }
};
