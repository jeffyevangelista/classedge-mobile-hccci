import {
  assessmentTable,
  attemptsTable,
  materialsTable,
  studentAssessment,
} from "@/powersync/schema";
import { db } from "@/powersync/system";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { union } from "drizzle-orm/sqlite-core";

export const getStudentCourses = async (studentId: number) => {
  const results = await db.query.studentEnrolledCoursesTable.findMany({
    where: (enrollment, { eq }) => eq(enrollment.studentId, studentId),
    with: {
      subjectId: {
        columns: {
          isHali: false,
          isCoil: false,
          isCte: false,
          subjectDescription: false,
          duration: false,
        },
        with: {
          assignTeacherId: {
            columns: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return results.filter(
    (enrollment) =>
      enrollment.subjectId !== null && enrollment.semesterId !== null,
  );
};

export async function getCourseTimeline(courseId: string, studentId: number) {
  const materials = db
    .select({
      id: sql<string>`CAST(${materialsTable.id} AS TEXT)`.as("id"),
      fileName: materialsTable.fileName,
      startDate: materialsTable.startDate,
      type: sql<string>`'material'`.as("type"),
      showScore: sql<number>`0`.as("show_score"),
      maxScore: sql<number>`0`.as("max_score"),
      classroomMode: sql<number>`0`.as("classroom_mode"),
    })
    .from(materialsTable)
    .where(eq(materialsTable.subjectId, Number(courseId)));

  const assessments = db
    .select({
      id: sql<string>`CAST(${assessmentTable.id} AS TEXT)`.as("id"),
      fileName: assessmentTable.activityName,
      startDate: assessmentTable.endTime,
      type: sql<string>`'assessment'`.as("type"),
      showScore: sql<number>`CASE WHEN ${assessmentTable.showScore} THEN 1 ELSE 0 END`.as(
        "show_score",
      ),
      maxScore: assessmentTable.maxScore,
      classroomMode: sql<number>`CASE WHEN ${assessmentTable.classroomMode} THEN 1 ELSE 0 END`.as(
        "classroom_mode",
      ),
    })
    .from(assessmentTable)
    .where(eq(assessmentTable.subjectId, Number(courseId)));

  const [timeline, submitted] = await Promise.all([
    union(materials, assessments).orderBy(desc(sql`start_date`)),
    db
      .selectDistinct({
        activityId: studentAssessment.activityId,
        totalScore: studentAssessment.totalScore,
      })
      .from(studentAssessment)
      .innerJoin(
        attemptsTable,
        eq(attemptsTable.studentActivityId, studentAssessment.id),
      )
      .where(
        and(
          eq(studentAssessment.studentId, studentId),
          eq(attemptsTable.status, "submitted"),
        ),
      ),
  ]);

  const submittedMap = new Map(
    submitted.map((r) => [r.activityId, r.totalScore]),
  );

  return timeline.map((item) => {
    const score = submittedMap.get(item.id);
    return {
      ...item,
      hasSubmission: item.type === "assessment" && score !== undefined ? 1 : 0,
      totalScore: score ?? 0,
    };
  });
}

export const getCourseMaterial = (materialId: string) => {
  return db.query.materialsTable.findFirst({
    where: (materialsTable, { eq }) =>
      eq(materialsTable.id, Number(materialId)),
  });
};

export const getCourseAssessment = async (assessmentIdentifier: string) => {
  const result = await db.query.assessmentTable.findFirst({
    where: (assessmentTable, { eq }) =>
      or(
        // eq(assessmentTable.localId, assessmentIdentifier),
        eq(assessmentTable.id, assessmentIdentifier),
      ),
  });
  return result ?? null;
};

export const getCourseDetails = async (courseId: string) => {
  const result = await db.query.studentEnrolledCoursesTable.findFirst({
    where: (enrollment, { eq }) => eq(enrollment.id, Number(courseId)),
    with: {
      subjectId: {
        columns: {
          isHali: false,
          isCoil: false,
          isCte: false,
          subjectDescription: false,
          duration: false,
        },
        with: {
          assignTeacherId: {
            columns: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      schedules: true,
    },
  });

  if (!result) {
    throw new Error(`Course with ID ${courseId} not found`);
  }

  return result;
};
