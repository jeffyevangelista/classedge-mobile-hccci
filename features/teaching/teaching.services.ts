import { coursesTable } from "@/powersync/schema";
import { db } from "@/powersync/system";
import { eq } from "drizzle-orm";

export const getTeachingCourses = (teacherId: number) => {
  return db.query.coursesTable.findMany({
    where: eq(coursesTable.assignTeacherId, teacherId),
  });
};
