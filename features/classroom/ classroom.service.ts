import { assessmentTable } from "@/powersync/schema";
import { db } from "@/powersync/system";

export const getActivities = (subjectId: string) => {
  return db.query.assessmentTable.findMany({
    where: (assessment, { eq }) =>
      eq(assessment.subjectId, parseInt(subjectId)) &&
      eq(assessment.classroomMode, 1),
  });
};

export const getGradingPeriods = () => {
  return db.query.gradingPeriodTable.findMany();
};

export const createActivity = (data: any) => {
  return db.insert(assessmentTable).values(data);
};
