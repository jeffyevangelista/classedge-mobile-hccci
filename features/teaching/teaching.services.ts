import { eq } from "drizzle-orm";
import { coursesTable } from "@/powersync/schema";
import { db } from "@/powersync/system";

export const getTeachingCourses = (teacherId: number) => {
  return db.query.coursesTable.findMany({
    where: eq(coursesTable.assignTeacherId, teacherId),
  });
};
