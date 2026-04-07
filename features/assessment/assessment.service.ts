import { attemptsTable, attemptAnswerTable } from "@/powersync/schema";
import { db } from "@/powersync/system";
import { eq } from "drizzle-orm";

export const getAssessmentDetails = async (
  assessmentId: number,
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

export const getAttemptRecords = (activityId: number, studentId: number) => {
  return db.query.attemptsTable.findMany({
    where: (attemptsTable, { and, eq }) =>
      and(
        eq(attemptsTable.studentActivityId, activityId),
        eq(attemptsTable.studentId, studentId),
      ),
  });
};

export const startAssessmentAttempt = (
  studentActivityId: number,
  studentId: number,
  duration: number,
  retakeNumber: number,
  activityId: number,
  questionOrder: number[],
) => {
  const now = new Date().toISOString();
  return db
    .insert(attemptsTable)
    .values({
      id: Date.now().toString(),
      studentActivityId: studentActivityId,
      studentId: studentId,
      retakeNumber: retakeNumber,
      score: 0,
      status: "ongoing",
      startedAt: now,
      willEndAt: new Date(Date.now() + duration * 60 * 1000).toISOString(),
      duration: duration * 60,
      activityId,
      questionOrder: JSON.stringify(questionOrder),
      lastIndex: 0,
      lastHeartbeatAt: now,
      totalElapsedSeconds: 0,
    })
    .returning();
};

export const getAssessmentAttempt = (localId: string) => {
  return db.query.attemptsTable.findFirst({
    where: (attemptsTable, { eq }) => eq(attemptsTable.localId, localId),
  });
};

export const getQuestions = (activityId: number) => {
  return db.query.assessmentQuestionTable.findMany({
    where: (assessmentQuestionTable, { eq }) =>
      eq(assessmentQuestionTable.activityId, activityId),
    orderBy: (assessmentQuestionTable, { asc }) => [
      asc(assessmentQuestionTable.id),
    ],
  });
};

export const getOrderedQuestions = async (
  activityId: number,
  questionOrder: number[],
) => {
  const questions = await db.query.assessmentQuestionTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  return questionOrder
    .map((id) => questionMap.get(id))
    .filter((q): q is NonNullable<typeof q> => q != null);
};

export const saveAnswer = async (
  retakeRecordId: string,
  activityQuestionId: number,
  studentId: number,
  studentAnswer: string,
) => {
  const existing = await db.query.attemptAnswerTable.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.retakeRecordId, retakeRecordId),
        eq(t.activityQuestionId, activityQuestionId),
      ),
  });

  if (existing) {
    return db
      .update(attemptAnswerTable)
      .set({ studentAnswer })
      .where(eq(attemptAnswerTable.localId, existing.localId))
      .returning();
  }

  return db
    .insert(attemptAnswerTable)
    .values({
      id: Date.now().toString(),
      retakeRecordId,
      activityQuestionId,
      studentId,
      studentAnswer,
      score: 0,
      uploadFile: "",
    })
    .returning();
};

export const getAnswersForAttempt = async (attemptLocalId: string) => {
  const attempt = await db.query.attemptsTable.findFirst({
    where: (t, { eq }) => eq(t.localId, attemptLocalId),
  });
  if (!attempt) return [];

  return db.query.attemptAnswerTable.findMany({
    where: (t, { eq }) => eq(t.retakeRecordId, attempt.id),
  });
};

export const updateHeartbeat = (
  attemptLocalId: string,
  totalElapsedSeconds: number,
) => {
  return db
    .update(attemptsTable)
    .set({
      lastHeartbeatAt: new Date().toISOString(),
      totalElapsedSeconds,
    })
    .where(eq(attemptsTable.localId, attemptLocalId));
};

export const updateLastIndex = (attemptLocalId: string, lastIndex: number) => {
  return db
    .update(attemptsTable)
    .set({ lastIndex })
    .where(eq(attemptsTable.localId, attemptLocalId));
};

export const submitAttempt = async (attemptLocalId: string, score: number) => {
  return db
    .update(attemptsTable)
    .set({
      status: "completed",
      score,
      lastHeartbeatAt: new Date().toISOString(),
    })
    .where(eq(attemptsTable.localId, attemptLocalId));
};
