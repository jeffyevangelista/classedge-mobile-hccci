import { coursesTable, studentEnrolledCoursesTable } from "@/powersync/schema";
import { db, powersync } from "@/powersync/system";
import { and, eq, inArray } from "drizzle-orm";

export const getTeachingCourses = (teacherId: number) => {
  return db.query.coursesTable.findMany({
    where: eq(coursesTable.assignTeacherId, teacherId),
  });
  // const assignedCourses = await db.query.coursesTable.findMany({
  //   where: eq(coursesTable.assignTeacherId, teacherId),
  // });
  // const assignedCourseIds = assignedCourses.map((c) => c.id);
  // if (assignedCourseIds.length === 0) return [];
  // return db.query.studentEnrolledCoursesTable.findMany({
  //   where: and(
  //     eq(studentEnrolledCoursesTable.isActiveSemester, 1),
  //     inArray(studentEnrolledCoursesTable.subjectId, assignedCourseIds),
  //   ),
  //   with: {
  //     subjectId: true,
  //   },
  // });
};
