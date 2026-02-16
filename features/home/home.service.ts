import { courseVisitsTable } from "@/powersync/schema";
import { db } from "@/powersync/system";

export const getAnnouncements = async () => {
  return await db.query.announcementsTable.findMany({
    with: {
      createdById: {
        columns: {
          studentPhoto: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
};

export const getRecentCourses = async () => {
  return await db.query.courseVisitsTable.findMany({
    with: {
      courseId: {
        columns: {
          id: true,
          subjectName: true,
          subjectCode: true,
        },
      },
    },
    orderBy: (courseVisits, { desc }) => [desc(courseVisits.visitedAt)],
    limit: 4,
  });
};

export const addRecentCourse = async (courseId: number) => {
  const id = Date.now();
  return await db.insert(courseVisitsTable).values({
    id,
    courseId,
    visitedAt: new Date().toISOString(),
  });
};
