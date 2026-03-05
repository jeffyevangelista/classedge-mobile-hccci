import {
  assessmentTable,
  coursesTable,
  materialsTable,
  studentEnrolledCoursesTable,
} from "@/powersync/schema";
import { db } from "@/powersync/system";
import { desc, eq, sql } from "drizzle-orm";
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
      id: materialsTable.id,
      fileName: materialsTable.fileName,
      startDate: materialsTable.startDate,
      type: sql`'material'`.as("type"),
    })
    .from(materialsTable)
    .where(eq(materialsTable.subjectId, Number(courseId)));

  const assessments = db
    .select({
      id: assessmentTable.id,
      fileName: assessmentTable.activityName,
      startDate: assessmentTable.endTime,
      type: sql`'assessment'`.as("type"),
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

export const getCourseAssessment = (assessmentId: string) => {
  return db.query.assessmentTable.findFirst({
    where: (assessmentTable, { eq }) =>
      eq(assessmentTable.id, Number(assessmentId)),
  });
};

export const getCourseDetails = (courseId: string) => {
  return db.query.studentEnrolledCoursesTable.findFirst({
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
    },
  });
};

export const getCourseStudents = async (subjectId: number) => {
  const results = await db.query.studentEnrolledCoursesTable.findMany({
    where: (enrollment, { eq }) => eq(enrollment.subjectId, subjectId),
    columns: {
      id: true,
      studentId: true,
    },
  });

  const studentsWithDetails = await Promise.all(
    results.map(async (enrollment) => {
      const studentDetails = await db.query.accountDetailsTable.findFirst({
        where: (profile, { eq }) => eq(profile.userId, enrollment.studentId),
        columns: {
          firstName: true,
          lastName: true,
          studentPhoto: true,
          gradeYearLevel: true,
        },
      });
      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        ...studentDetails,
      };
    }),
  );

  return studentsWithDetails.filter((student) => student.firstName);
};
