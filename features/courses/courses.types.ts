import { drizzleSchema } from "@/powersync/schema";
import {
  type BuildQueryResult,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
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
