import { db } from "@/powersync/system";
import { or } from "drizzle-orm";

// Returns the drizzle query builder (not awaited) so it can be wrapped
// with `toCompilableQuery` and fed to PowerSync's watch hook. The
// defensive subjectId-null filter that used to live here now sits in
// `useStudentCourses` as a useMemo over the watch result.
export const getStudentCourses = (studentId: number) => {
  return db.query.studentEnrolledCoursesTable.findMany({
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
};

export const getCourseMaterial = (materialId: string) => {
  return db.query.materialsTable.findFirst({
    where: (materialsTable, { eq }) =>
      eq(materialsTable.id, Number(materialId)),
  });
};

// Returns the drizzle query builder so the hook can wrap it with
// `toCompilableQuery` for watch. The hook handles the "no row" case by
// returning `null` to the consumer.
export const getCourseAssessment = (assessmentIdentifier: string) => {
  return db.query.assessmentTable.findFirst({
    where: (assessmentTable, { eq }) =>
      or(
        // eq(assessmentTable.localId, assessmentIdentifier),
        eq(assessmentTable.id, assessmentIdentifier),
      ),
  });
};

// Returns the drizzle query builder so the hook can wrap it with
// `toCompilableQuery` for watch. "Not found" no longer throws; consumers
// already optional-chain the nested fields.
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
      schedules: true,
    },
  });
};
