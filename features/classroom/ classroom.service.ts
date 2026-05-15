import { assessmentTable, studentAssessment } from "@/powersync/schema";
import { db, powersync } from "@/powersync/system";
import { sql } from "drizzle-orm";
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

export const getGradingPeriods = () => {
  return db.query.gradingPeriodTable.findMany();
};

export const getActivityTypes = () => {
  return db.query.activtyType.findMany();
};

export const createActivity = async (
  data: Omit<typeof assessmentTable.$inferInsert, "id" | "localId"> & {
    id?: string;
    localId?: string;
  },
) => {
  const localId = data.localId ?? createId();
  const id = data.id ?? localId;

  const payload = { ...data, id, localId };
  console.log("[createActivity] inserting:", JSON.stringify(payload));

  const result = await db.insert(assessmentTable).values(payload);
  console.log("[createActivity] insert result:", JSON.stringify(result));

  // Verify the row actually landed in the local DB by reading it back directly.
  const verify = await powersync.execute(
    "SELECT id, local_id, activity_name FROM activity_activity WHERE local_id = ?",
    [localId],
  );
  console.log(
    "[createActivity] verify after insert:",
    JSON.stringify(verify.rows?._array),
  );

  return { result, id, localId };
};

export const getClassroomStudents = (classroomId: string) => {
  return db.query.studentEnrolledCoursesTable.findMany({
    where: (student, { eq }) => eq(student.subjectId, parseInt(classroomId)),
    with: {
      profile: true,
    },
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
  activityId: string;
  termId: number;
  activityLocalId: string;
  subjectId: number;
  totalScore: number;
  file?: string | null;
}) => {
  const existing = await powersync.execute(
    "SELECT * FROM activity_studentactivity WHERE activity_local_id = ? AND student_id = ? LIMIT 1",
    [data.activityLocalId, data.studentId],
  );

  const existingRow = existing.rows?._array?.[0] ?? existing.rows?.item(0);

  if (existingRow) {
    return powersync.execute(
      "UPDATE activity_studentactivity SET total_score = ?, file = ? WHERE local_id = ?",
      [
        data.totalScore,
        data.file ?? existingRow.file ?? null,
        existingRow.local_id,
      ],
    );
  }

  try {
    const localId = createId();
    return await powersync.execute(
      `INSERT INTO activity_studentactivity (local_id, id, student_id, activity_id, term_id, subject_id, total_score, retake_count, is_editable, activity_local_id, file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        localId,
        localId,
        data.studentId,
        data.activityLocalId,
        data.termId,
        data.subjectId,
        data.totalScore,
        0,
        1,
        data.activityLocalId,
        data.file ?? null,
      ],
    );
  } catch (err) {
    console.error("[upsertStudentScore] INSERT FAILED:", err);
    throw err;
  }
};
