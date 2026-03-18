import { attemptsTable } from "@/powersync/schema";
import { db } from "@/powersync/system";

export const getAssessmentDetails = (assessmentId: number, userId: number) => {
  return db.query.studentAssessment.findFirst({
    where: (studentAssessment, { and, eq }) =>
      and(
        eq(studentAssessment.activityId, assessmentId),
        eq(studentAssessment.studentId, userId),
      ),
  });
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
) => {
  return db
    .insert(attemptsTable)
    .values({
      id: Date.now().toString(),
      studentActivityId: studentActivityId,
      studentId: studentId,
      retakeNumber: retakeNumber,
      score: 0,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      willEndAt: new Date(Date.now() + duration * 60 * 1000).toISOString(),
      duration: duration * 60,
      activityId,
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
