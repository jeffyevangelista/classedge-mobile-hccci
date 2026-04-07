import { assessmentTable, studentAssessment } from "@/powersync/schema";
import { db, powersync } from "@/powersync/system";
import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import * as FileSystem from "expo-file-system/legacy";

export const saveAttachment = async (imageUri: string): Promise<string> => {
  const id = createId();
  const ext = imageUri.split(".").pop() ?? "jpg";
  const filename = `${id}.${ext}`;

  const dir = `${FileSystem.documentDirectory}attachments/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const permanentUri = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: imageUri, to: permanentUri });

  console.log("[saveAttachment] copied to:", permanentUri);
  return permanentUri;
};

export const getActivities = (subjectId: string) => {
  return db.query.assessmentTable.findMany({
    where: (assessment, { eq }) =>
      eq(assessment.subjectId, parseInt(subjectId)) &&
      eq(assessment.classroomMode, 1),
  });
};

export const getActivityById = (activityId: string) => {
  return db.query.assessmentTable.findFirst({
    where: (assessment, { eq }) => eq(assessment.localId, activityId),
  });
};

export const getGradingPeriods = () => {
  return db.query.gradingPeriodTable.findMany();
};

export const createActivity = (data: any) => {
  return db.insert(assessmentTable).values(data);
};

export const getClassroomStudents = (classroomId: string) => {
  return db.query.studentEnrolledCoursesTable.findMany({
    where: (student, { eq }) => eq(student.subjectId, parseInt(classroomId)),
  });
};

export const getStudentScoresForActivity = (activityLocalId: string) => {
  return db
    .select()
    .from(studentAssessment)
    .where(sql`${studentAssessment.activityLocalId} = ${activityLocalId}`);
};

export const upsertStudentScore = async (data: {
  studentId: number;
  activityId: number;
  termId: number;
  activityLocalId: string;
  subjectId: number;
  totalScore: number;
  file?: string | null;
}) => {
  console.log("[upsertStudentScore] called with:", JSON.stringify(data));

  const existing = await powersync.execute(
    "SELECT * FROM activity_studentactivity WHERE activity_local_id = ? AND student_id = ? LIMIT 1",
    [data.activityLocalId, data.studentId],
  );

  const existingRow = existing.rows?._array?.[0] ?? existing.rows?.item(0);
  console.log("[upsertStudentScore] existing:", existingRow);

  if (existingRow) {
    console.log("[upsertStudentScore] updating existing record");
    const result = await powersync.execute(
      "UPDATE activity_studentactivity SET total_score = ?, file = ? WHERE local_id = ?",
      [
        data.totalScore,
        data.file ?? existingRow.file ?? null,
        existingRow.local_id,
      ],
    );
    console.log("[upsertStudentScore] updated:", JSON.stringify(result));
    return result;
  }

  try {
    // Check table schema
    const tableInfo = await powersync.execute(
      "PRAGMA table_info(activity_studentactivity)",
    );
    console.log(
      "[upsertStudentScore] table schema:",
      JSON.stringify(tableInfo.rows?._array),
    );

    const localId = createId();
    const id = createId();
    const result = await powersync.execute(
      `INSERT INTO activity_studentactivity (id, student_id, activity_id, term_id, subject_id, total_score, retake_count, is_editable, local_id, activity_local_id, file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.studentId,
        data.activityId,
        data.termId,
        data.subjectId,
        data.totalScore,
        0,
        1,
        localId,
        data.activityLocalId,
        data.file ?? null,
      ],
    );
    console.log("[upsertStudentScore] insert result:", JSON.stringify(result));

    // Verify the data was actually written
    const verify = await powersync.execute(
      "SELECT * FROM activity_studentactivity WHERE id = ?",
      [id],
    );
    console.log(
      "[upsertStudentScore] verify after insert:",
      JSON.stringify(verify.rows?._array),
    );

    return result;
  } catch (err) {
    console.error("[upsertStudentScore] INSERT FAILED:", err);
    throw err;
  }
};
