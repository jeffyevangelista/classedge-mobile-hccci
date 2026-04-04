import { assessmentTable, studentAssessment } from "@/powersync/schema";
import { db } from "@/powersync/system";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const getActivities = (subjectId: string) => {
  return db.query.assessmentTable.findMany({
    where: (assessment, { eq }) =>
      eq(assessment.subjectId, parseInt(subjectId)) &&
      eq(assessment.classroomMode, 1),
  });
};

export const getActivityById = (activityId: string) => {
  return db.query.assessmentTable.findFirst({
    where: (assessment, { eq }) => eq(assessment.localId, activityId),
  });
};

export const getGradingPeriods = () => {
  return db.query.gradingPeriodTable.findMany();
};

export const createActivity = (data: any) => {
  return db.insert(assessmentTable).values(data);
};

export const getClassroomStudents = (classroomId: string) => {
  return db.query.studentEnrolledCoursesTable.findMany({
    where: (student, { eq }) => eq(student.subjectId, parseInt(classroomId)),
  });
};

export const getStudentScoresForActivity = (activityId: number) => {
  return db.query.studentAssessment.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
  });
};

export const upsertStudentScore = async (data: {
  studentId: number;
  activityId: number;
  termId: number;
  subjectId: number;
  totalScore: number;
}) => {
  const existing = await db.query.studentAssessment.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.activityId, data.activityId), eq(t.studentId, data.studentId)),
  });

  if (existing) {
    return db
      .update(studentAssessment)
      .set({ totalScore: data.totalScore })
      .where(eq(studentAssessment.id, existing.id));
  }

  return db.insert(studentAssessment).values({
    id: createId(),
    ...data,
    retakeCount: 0,
    isEditable: 1,
  });
};
