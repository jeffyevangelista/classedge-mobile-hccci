import { assessmentTable, materialsTable } from "@/powersync/schema";
import { db } from "@/powersync/system";
import { desc, eq, or, sql } from "drizzle-orm";
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

export async function getCourseTimeline(courseId: string) {
  const materials = db
    .select({
      id: sql<string>`CAST(${materialsTable.id} AS TEXT)`.as("id"),
      fileName: materialsTable.fileName,
      startDate: materialsTable.startDate,
      type: sql<string>`'material'`.as("type"),
    })
    .from(materialsTable)
    .where(eq(materialsTable.subjectId, Number(courseId)));

  const assessments = db
    .select({
      id: assessmentTable.localId,
      fileName: assessmentTable.activityName,
      startDate: assessmentTable.endTime,
      type: sql<string>`'assessment'`.as("type"),
    })
    .from(assessmentTable)
    .where(eq(assessmentTable.subjectId, Number(courseId)));

  const timelineData = union(materials, assessments).orderBy(
    desc(sql`start_date`),
  );

  return timelineData;
}

export const getCourseMaterial = (materialId: string) => {
  return db.query.materialsTable.findFirst({
    where: (materialsTable, { eq }) =>
      eq(materialsTable.id, Number(materialId)),
  });
};

export const getCourseAssessment = (assessmentIdentifier: string) => {
  return db.query.assessmentTable.findFirst({
    where: (assessmentTable, { eq }) =>
      or(
        eq(assessmentTable.localId, assessmentIdentifier),
        eq(assessmentTable.id, assessmentIdentifier),
      ),
  });
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
