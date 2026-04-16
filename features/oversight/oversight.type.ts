export type SubjectType = {
  id: number;
  assignTeacherName: string;
  subjectName: string;
  subjectCode: string;
  subjectDescription: string;
  subjectPhoto: string;
  teacherName: string;
  teacherEmail: string;
  teacherPhoto: string;
  roomNumber: string;
};

export type Lesson = {
  id: number;
  subjectId: number;
  lessonName: string;
  lessonDescription: string;
  lessonFile: string | null;
  lessonUrl: string | null;
  lessonType: string;
  startDate: string;
  endDate: string;
  allowDownload: boolean;
};

type LessonUrl = {
  id: number;
  lessonName: string;
  lessonUrl: null | any;
  lessonFile: string;
};

export type Assessment = {
  id: number;
  activityName: string;
  activityType: number;
  activityTypeName: string;
  subjectId: number;
  startTime: string; // ISO string
  endTime: string; // ISO string
  showScore: boolean;
  maxScore: number;
  passingScore: number;
  passingScoreType: "percentage" | "points"; // inferred; add more if needed
  timeDuration: number;
  maxRetake: number;
  retakeMethod: "highest" | string; // can refine if backend has strict choices
  activityInstruction: string;
  classroomMode: boolean;
  shuffleQuestions: boolean;
  studentRetakeCount: number;
  remainingAttempts: number;
  lessonUrls: LessonUrl[];
  attempts: any[];
  ongoingAttempt: any | null;
};

export type Student = {
  id: number;
  name: string;
  studentPhoto: string;
};
