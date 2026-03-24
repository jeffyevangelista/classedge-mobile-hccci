import { type InferSelectModel, relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
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
  subjectType: text("subject_type").notNull(),
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

export const courseScheduleTable = sqliteTable("subject_schedule", {
  id: integer("id").primaryKey(),
  scheduleStartTime: text("schedule_start_time").notNull(),
  scheduleEndTime: text("schedule_end_time").notNull(),
  daysOfWeek: text("days_of_week").notNull(),
  subjectId: integer("subject_id").notNull(),
  isActiveSemester: integer("is_active_semester").notNull(),
});

export const courseScheduleRelations = relations(
  courseScheduleTable,
  ({ one }) => ({
    subjectId: one(coursesTable, {
      fields: [courseScheduleTable.subjectId],
      references: [coursesTable.id],
    }),
    enrollment: one(studentEnrolledCoursesTable, {
      fields: [courseScheduleTable.subjectId],
      references: [studentEnrolledCoursesTable.subjectId],
    }),
  }),
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
  ({ one, many }) => ({
    subjectId: one(coursesTable, {
      fields: [studentEnrolledCoursesTable.subjectId],
      references: [coursesTable.id],
    }),
    semesterId: one(academicTermsTable, {
      fields: [studentEnrolledCoursesTable.semesterId],
      references: [academicTermsTable.id],
    }),
    schedules: many(courseScheduleTable),
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

export const eventsTable = sqliteTable("calendars_event", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  endDate: text("end_date").notNull(),
  startDate: text("start_date").notNull(),
});

export const eventRelations = relations(eventsTable, ({ one, many }) => ({
  createdById: one(accountDetailsTable, {
    fields: [eventsTable.createdById],
    references: [accountDetailsTable.userId],
  }),

  announcements: many(announcementEventJoin),
}));

export const announcementsTable = sqliteTable("calendars_announcement", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
});

export const announcementRelations = relations(
  announcementsTable,
  ({ one, many }) => ({
    createdById: one(accountDetailsTable, {
      fields: [announcementsTable.createdById],
      references: [accountDetailsTable.userId],
    }),
    // This allows you to access the join table from an announcement
    events: many(announcementEventJoin),
  }),
);

export const announcementEventJoin = sqliteTable(
  "calendars_announcement_events",
  {
    id: integer("id").primaryKey(),
    announcementId: integer("announcement_id").notNull(),
    eventId: integer("event_id").notNull(),
  },
);

export const announcementEventRelations = relations(
  announcementEventJoin,
  ({ one }) => ({
    announcement: one(announcementsTable, {
      fields: [announcementEventJoin.announcementId],
      references: [announcementsTable.id],
    }),
    event: one(eventsTable, {
      fields: [announcementEventJoin.eventId],
      references: [eventsTable.id],
    }),
  }),
);

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

export const studentAssessment = sqliteTable("activity_studentactivity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  activityId: integer("activity_id").notNull(),
  termId: integer("term_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  retakeCount: integer("retake_count").notNull(),
  totalScore: integer("total_score").notNull(),
  isEditable: integer("is_editable").notNull(),
});

export const studentAssessmentRelations = relations(
  studentAssessment,
  ({ one, many }) => ({
    studentId: one(accountDetailsTable, {
      fields: [studentAssessment.studentId],
      references: [accountDetailsTable.userId],
    }),
    activityId: one(assessmentTable, {
      fields: [studentAssessment.activityId],
      references: [assessmentTable.id],
    }),
    termId: one(academicTermsTable, {
      fields: [studentAssessment.termId],
      references: [academicTermsTable.id],
    }),
    subjectId: one(coursesTable, {
      fields: [studentAssessment.subjectId],
      references: [coursesTable.id],
    }),
    retakeRecords: many(attemptsTable),
  }),
);

export const attemptsTable = sqliteTable("activity_retakerecord", {
  id: text("id").primaryKey(),
  studentActivityId: integer("student_activity_id").notNull(),
  retakeNumber: integer("retake_number").notNull(),
  score: integer("score").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  willEndAt: text("will_end_at").notNull(),
  studentId: integer("student_id").notNull(),
  duration: integer("duration").notNull(),
  localId: text("local_id")
    .notNull()
    .$defaultFn(() => createId()),
  activityId: integer("activity_id").notNull(),
  questionOrder: text("question_order").notNull().default("[]"),
  lastIndex: integer("last_index").notNull().default(0),
  lastHeartbeatAt: text("last_heartbeat_at").notNull().default(utcNow),
  totalElapsedSeconds: integer("total_elapsed_seconds").notNull().default(0),
});

export const attemptsRelations = relations(attemptsTable, ({ one }) => ({
  studentActivity: one(studentAssessment, {
    fields: [attemptsTable.studentActivityId],
    references: [studentAssessment.id],
  }),
}));

export const assessmentQuestionTable = sqliteTable(
  "activity_activityquestion",
  {
    id: integer("id").primaryKey(),
    questionText: text("question_text").notNull(),
    questionInstruction: text("question_instruction").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    score: integer("score").notNull(),
    activityId: integer("activity_id").notNull(),
    quizTypeId: integer("quiz_type_id").notNull(),
    subjectId: integer("subject_id").notNull(),
  },
);

export const questionType = sqliteTable("activity_quiztype", {
  id: integer("id").notNull(),
  name: text("name").notNull(),
});

export const assessmentQuestionTableRelation = relations(
  assessmentQuestionTable,
  ({ one }) => ({
    activityId: one(assessmentTable, {
      fields: [assessmentQuestionTable.activityId],
      references: [assessmentTable.id],
    }),
    subjectId: one(coursesTable, {
      fields: [assessmentQuestionTable.subjectId],
      references: [coursesTable.id],
    }),
    quizTypeId: one(questionType, {
      fields: [assessmentQuestionTable.quizTypeId],
      references: [questionType.id],
    }),
  }),
);

export const assessmentQuestionsTable = sqliteTable("activity_questionchoice", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  activityId: integer("activity_id").notNull(),
  choiceText: text("choice_text").notNull(),
  isLeftSide: text("is_left_side").notNull(),
  questionId: integer("question_id").notNull(),
});

export const assessmentQuestionsTableRelations = relations(
  assessmentQuestionsTable,
  ({ one }) => ({
    questionId: one(assessmentQuestionTable, {
      fields: [assessmentQuestionsTable.questionId],
      references: [assessmentQuestionTable.id],
    }),
  }),
);

export const attemptAnswerTable = sqliteTable("activity_retakerecorddetail", {
  id: text("id").primaryKey(),
  studentAnswer: text("student_answer").notNull(),
  score: integer("score").notNull(),
  uploadFile: text("upload_file").notNull(),
  activityQuestionId: integer("activity_question_id").notNull(),
  retakeRecordId: text("retake_record_id").notNull(),
  studentId: integer("student_id").notNull(),
  localId: text("local_id")
    .notNull()
    .$defaultFn(() => createId()),
});

export const attemptAnswerTableRelations = relations(
  attemptAnswerTable,
  ({ one }) => ({
    activityQuestionId: one(assessmentQuestionsTable, {
      fields: [attemptAnswerTable.activityQuestionId],
      references: [assessmentQuestionsTable.id],
    }),
    retakeRecordId: one(attemptsTable, {
      fields: [attemptAnswerTable.retakeRecordId],
      references: [attemptsTable.id],
    }),
    studentId: one(accountsTable, {
      fields: [attemptAnswerTable.studentId],
      references: [accountsTable.id],
    }),
  }),
);

export const drizzleSchema = {
  courseScheduleTable,
  courseScheduleRelations,
  eventsTable,
  announcementEventRelations,
  eventRelations,
  announcementEventJoin,
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
  studentAssessment,
  studentAssessmentRelations,
  attemptsTable,
  attemptsRelations,
  assessmentQuestionTable,
  assessmentQuestionTableRelation,
  questionType,
  assessmentQuestionsTable,
  assessmentQuestionsTableRelations,
  attemptAnswerTable,
  attemptAnswerTableRelations,
};

export type Subject = InferSelectModel<typeof coursesTable>;
export type Assessment = InferSelectModel<typeof assessmentTable>;
export type AccountDetails = InferSelectModel<typeof accountDetailsTable>;
export type Notification = InferSelectModel<typeof notificationsTable> & {
  createdById: AccountDetails;
};

export type Event = InferSelectModel<typeof eventsTable>;
