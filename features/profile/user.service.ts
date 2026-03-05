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

export const getStudentCourseSchedules = async (studentId: number) => {
  const enrollments = await db.query.studentEnrolledCoursesTable.findMany({
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
    where: (enrollment, { eq }) => eq(enrollment.studentId, studentId),
  });

  const enrollmentsWithSchedules = await Promise.all(
    enrollments.map(async (enrollment) => {
      const schedules = await db.query.courseScheduleTable.findMany({
        where: (schedule, { eq }) =>
          eq(schedule.subjectId, enrollment.subjectId.id),
      });
      return {
        ...enrollment,
        schedules,
      };
    }),
  );

  return enrollmentsWithSchedules;
};

export const getAllSchedules = () => {
  return db.query.courseScheduleTable.findMany({
    with: {
      subjectId: true,
    },
  });
};
