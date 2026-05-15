import { attemptsTable, attemptAnswerTable } from "@/powersync/schema";
import { db } from "@/powersync/system";
import { eq, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { queryClient } from "@/providers/QueryProvider";

export const getAssessmentDetails = async (
  assessmentId: string,
  userId: number,
) => {
  const result = await db.query.studentAssessment.findFirst({
    where: (studentAssessment, { and, eq }) =>
      and(
        eq(studentAssessment.activityId, assessmentId),
        eq(studentAssessment.studentId, userId),
      ),
  });
  return result ?? null;
};

export const getAttemptRecords = async (
  studentActivityId: string,
  studentId: number,
) => {
  console.log("[getAttemptRecords] params:", {
    studentActivityId,
    typeofStudentActivityId: typeof studentActivityId,
    studentId,
  });
  const rows = await db.query.attemptsTable.findMany({
    where: (t, { and, eq }) =>
      and(
        eq(t.studentActivityId, studentActivityId),
        eq(t.studentId, studentId),
      ),
  });
  console.log("[getAttemptRecords] matched count:", rows.length, "rows:", rows);
  if (rows.length === 0) {
    const allForStudent = await db.query.attemptsTable.findMany({
      where: (t, { eq }) => eq(t.studentId, studentId),
    });
    console.log(
      "[getAttemptRecords] all attempts for studentId=",
      studentId,
      "count=",
      allForStudent.length,
      "rows=",
      allForStudent,
    );
  }
  return rows;
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

export const getQuestionCount = async (
  activityId: string,
): Promise<number> => {
  const rows = await db.query.assessmentQuestionTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    columns: { id: true },
  });
  return rows.length;
};

export const getOrderedQuestions = async (
  activityId: string,
  questionOrder: number[],
) => {
  console.log("[getOrderedQuestions] called with:", {
    activityId,
    questionOrder,
  });
  if (!Array.isArray(questionOrder) || questionOrder.length === 0) {
    console.warn(
      "[getOrderedQuestions] non-array questionOrder, returning []:",
      questionOrder,
    );
    return [];
  }
  const questions = await db.query.assessmentQuestionTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
  });
  console.log(
    "[getOrderedQuestions] questions found for activityId:",
    questions.length,
    "ids:",
    questions.map((q) => q.id),
  );

  if (questions.length === 0) {
    const sample = await db.query.assessmentQuestionTable.findMany({});
    console.log(
      "[getOrderedQuestions] sample of all question rows (count=",
      sample.length,
      "):",
      sample.slice(0, 5).map((q) => ({ id: q.id, activityId: q.activityId })),
    );
  }

  const questionMap = new Map(questions.map((q) => [String(q.id), q]));
  const ordered = questionOrder
    .map((id) => questionMap.get(String(id)))
    .filter((q): q is NonNullable<typeof q> => q != null);
  console.log("[getOrderedQuestions] final ordered count:", ordered.length);
  return ordered;
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

export const getAnswersForAttempt = async (attemptLocalId: string) => {
  console.log("[getAnswersForAttempt] attemptLocalId:", attemptLocalId);
  const attempt = await db.query.attemptsTable.findFirst({
    where: (t, { eq }) => eq(t.localId, attemptLocalId),
  });
  console.log(
    "[getAnswersForAttempt] attempt row:",
    attempt
      ? { id: attempt.id, localId: attempt.localId, status: attempt.status }
      : null,
  );
  if (!attempt) return [];

  const rows = await db.query.attemptAnswerTable.findMany({
    where: (t, { eq }) => eq(t.retakeRecordId, attempt.id),
  });
  console.log(
    "[getAnswersForAttempt] answer rows count:",
    rows.length,
    "sample:",
    rows.slice(0, 5).map((r) => ({
      id: r.id,
      retakeRecordId: r.retakeRecordId,
      activityQuestionId: r.activityQuestionId,
      studentAnswer: r.studentAnswer,
    })),
  );
  if (rows.length === 0) {
    const all = await db.query.attemptAnswerTable.findMany({});
    console.log(
      "[getAnswersForAttempt] all answer rows count:",
      all.length,
      "sample:",
      all.slice(0, 5).map((r) => ({
        id: r.id,
        retakeRecordId: r.retakeRecordId,
        studentId: r.studentId,
      })),
    );
  }
  return rows;
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

export const getChoicesForActivity = async (activityId: string) => {
  console.log("[getChoicesForActivity] activityId:", activityId);
  const questions = await db.query.assessmentQuestionTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    columns: { id: true },
  });
  const questionIds = questions.map((q) => q.id);
  console.log("[getChoicesForActivity] questionIds:", questionIds);
  if (questionIds.length === 0) return [];
  const choices = await db.query.assessmentQuestionsTable.findMany({
    where: (t) => inArray(t.questionId, questionIds),
    orderBy: (t, { asc }) => [asc(t.id)],
  });
  console.log(
    "[getChoicesForActivity] choices count:",
    choices.length,
    "sample:",
    choices.slice(0, 3),
  );
  if (choices.length === 0) {
    const sample = await db.query.assessmentQuestionsTable.findMany({});
    console.log(
      "[getChoicesForActivity] all choice rows count=",
      sample.length,
      "sample=",
      sample
        .slice(0, 5)
        .map((c) => ({ id: c.id, questionId: c.questionId, text: c.choiceText })),
    );
  }
  return choices;
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
  console.log("[createAttempt] params:", params);
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
    console.log("[createAttempt] inserted row:", inserted[0]);
    return inserted[0];
  } catch (err) {
    console.error("[createAttempt] insert failed:", err);
    throw err;
  }
};
