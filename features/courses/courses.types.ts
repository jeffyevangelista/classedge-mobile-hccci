import type { BuildQueryResult, ExtractTablesWithRelations } from "drizzle-orm";
import type { drizzleSchema } from "@/powersync/schema";

type Schema = typeof drizzleSchema;
type TTables = ExtractTablesWithRelations<Schema>;

export type StudentEnrollmentWithDetails = BuildQueryResult<
  TTables,
  TTables["studentEnrolledCoursesTable"],
  {
    with: {
      // semesterId: true;
      subjectId: {
        columns: {
          isHali: false;
          isCoil: false;
          isCte: false;
          subjectDescription: false;
          duration: false;
        };
        with: {
          assignTeacherId: {
            columns: {
              firstName: true;
              lastName: true;
            };
          };
        };
      };
    };
  }
>;

export type StudentEnrolledCourses = StudentEnrollmentWithDetails;

export type Assessment = {
  id: number;
  activityName: string;
  activityType: string;
  subjectName: string;
  startTime: string;
  retakeCount: number;
};
