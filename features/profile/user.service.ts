import { db } from "@/powersync/system";

export const getUserDetails = (userId: number) => {
  return db.query.accountDetailsTable.findFirst({
    with: {
      userId: {
        columns: {
          email: true,
        },
      },
    },
    where: (accountDetails, { eq }) => eq(accountDetails.userId, userId),
  });
};

// Returns the drizzle query builder (not awaited) so it can be wrapped
// with `toCompilableQuery` and fed to PowerSync's watch hook. Mirrors
// the `getStudentCourses` pattern in features/courses/courses.service.ts.
export const getStudentCourseSchedules = (studentId: number) => {
  return db.query.studentEnrolledCoursesTable.findMany({
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
    where: (enrollment, { eq }) => eq(enrollment.studentId, studentId),
  });
};

export const getAllSchedules = () => {
  return db.query.courseScheduleTable.findMany({
    with: {
      subjectId: true,
    },
  });
};
