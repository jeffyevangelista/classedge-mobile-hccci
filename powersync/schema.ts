import notifications from "@/app/(main)/(tabs)/notifications";
import {
  type InferInsertModel,
  type InferSelectModel,
  relations,
  sql,
} from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const utcNow = sql`(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`;

export const accountsTable = sqliteTable("accounts_customuser", {
  id: integer("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull(),
});

export const accountDetailsTable = sqliteTable("accounts_profile", {
  id: integer("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  studentPhoto: text("student_photo").notNull(),
  gender: text("gender").notNull(),
  nationality: text("nationality").notNull(),
  address: text("address").notNull(),
  phoneNumber: text("phone_number").notNull(),
  idNumber: text("id_number").notNull(),
  gradeYearLevel: integer("grade_year_level").notNull(),
  courseId: integer("course_id").notNull(),
  departmentFieldsId: integer("department_fields_id").notNull(),
  userId: integer("user_id").notNull(),
});

export const accountsDetailsRelations = relations(
  accountDetailsTable,
  ({ one }) => ({
    userId: one(accountsTable, {
      fields: [accountDetailsTable.userId],
      references: [accountsTable.id],
    }),
  }),
);

export const coursesTable = sqliteTable("subject_subject", {
  id: integer("id").primaryKey(),
  subjectName: text("subject_name").notNull(),
  subjectDescription: text("subject_description").notNull(),
  subjectCode: text("subject_code").notNull(),
  subjectPhoto: text("subject_photo").notNull(),
  roomNumber: text("room_number").notNull(),
  isHali: integer("is_hali").notNull(),
  isCoil: integer("is_coil").notNull(),
  isCte: integer("is_cte").notNull(),
  duration: text("duration").notNull(),
  assignTeacherId: integer("assign_teacher_id").notNull(),
});

export const subjectRelations = relations(coursesTable, ({ one }) => ({
  assignTeacherId: one(accountDetailsTable, {
    fields: [coursesTable.assignTeacherId],
    references: [accountDetailsTable.userId],
  }),
}));

export const academicTermsTable = sqliteTable("course_semester", {
  id: integer("id").primaryKey(),
  semesterName: text("semester_name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  endSemester: integer("end_semester").notNull(),
  passingGrade: integer("passing_grade").notNull(),
  gradeCalculationMethod: text("grade_calculation_method").notNull(),
  createdAt: text("created_at").notNull().default(utcNow),
});

export const studentEnrolledCoursesTable = sqliteTable(
  "course_subjectenrollment",
  {
    id: integer("id").primaryKey(),
    semesterId: integer("semester_id").notNull(),
    studentId: integer("student_id").notNull(),
    subjectId: integer("subject_id").notNull(),
    isActiveSemester: integer("is_active_semester").notNull(),
  },
);

export const materialsTable = sqliteTable("module_module", {
  id: integer("id").primaryKey(),
  fileName: text("file_name").notNull(),
  file: text("file").notNull(),
  iframeCode: text("iframe_code").notNull(),
  url: text("url").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  description: text("description").notNull(),
  subjectId: integer("subject_id").notNull(),
});

export const studentEnrolledCoursesRelations = relations(
  studentEnrolledCoursesTable,
  ({ one }) => ({
    subjectId: one(coursesTable, {
      fields: [studentEnrolledCoursesTable.subjectId],
      references: [coursesTable.id],
    }),
    semesterId: one(academicTermsTable, {
      fields: [studentEnrolledCoursesTable.semesterId],
      references: [academicTermsTable.id],
    }),
  }),
);

export const notificationsTable = sqliteTable("logs_notification", {
  id: integer("id").primaryKey(),
  entityId: integer("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  userId: integer("user_id_id").notNull(),
});

export const notificationRelations = relations(
  notificationsTable,
  ({ one }) => ({
    createdById: one(accountDetailsTable, {
      fields: [notificationsTable.createdById],
      references: [accountDetailsTable.userId],
    }),
  }),
);

export const announcementsTable = sqliteTable("calendars_announcement", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
});

export const announcementRelations = relations(
  announcementsTable,
  ({ one }) => ({
    createdById: one(accountDetailsTable, {
      fields: [announcementsTable.createdById],
      references: [accountDetailsTable.userId],
    }),
  }),
);

export const eventsTable = sqliteTable("calendars_event", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
});

export const eventRelations = relations(eventsTable, ({ one }) => ({
  createdById: one(accountDetailsTable, {
    fields: [eventsTable.createdById],
    references: [accountDetailsTable.userId],
  }),
}));

export const assessmentTable = sqliteTable("activity_activity", {
  id: integer("id").primaryKey(),
  activityName: text("activity_name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  showScore: integer("show_score").notNull(),
  maxRetake: integer("max_retake").notNull(),
  timeDuration: integer("time_duration").notNull(),
  maxScore: integer("max_score").notNull(),
  passingScore: integer("passing_score").notNull(),
  passingScoreType: text("passing_score_type").notNull(),
  retakeMethod: text("retake_method").notNull(),
  activityInstruction: text("activity_instruction").notNull(),
  isGraded: integer("is_graded").notNull(),
  shuffleQuestions: integer("shuffle_questions").notNull(),
  subjectId: integer("subject_id").notNull(),
  activityTypeId: integer("activity_type_id").notNull(),
});

export const assessmentRelations = relations(assessmentTable, ({ one }) => ({
  subjectId: one(coursesTable, {
    fields: [assessmentTable.subjectId],
    references: [coursesTable.id],
  }),
}));

export const courseVisitsTable = sqliteTable("course_visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull(),
  visitedAt: text("visited_at").notNull(),
});

export const courseVisitsRelations = relations(
  courseVisitsTable,
  ({ one }) => ({
    courseId: one(coursesTable, {
      fields: [courseVisitsTable.courseId],
      references: [coursesTable.id],
    }),
  }),
);

const courseVisitsWithOptions = {
  tableDefinition: courseVisitsTable,
  options: {
    localOnly: true,
  },
};

export const drizzleSchema = {
  accountsTable,
  accountDetailsTable,
  accountsDetailsRelations,
  academicTermsTable,
  studentEnrolledCoursesTable,
  coursesTable,
  notificationsTable,
  announcementsTable,
  studentEnrolledCoursesRelations,
  subjectRelations,
  notificationRelations,
  announcementRelations,
  materialsTable,
  assessmentTable,
  assessmentRelations,
  courseVisitsTable: courseVisitsWithOptions,
  courseVisitsRelations,
};

export type Subject = InferSelectModel<typeof coursesTable>;
export type Assessment = InferSelectModel<typeof assessmentTable>;
