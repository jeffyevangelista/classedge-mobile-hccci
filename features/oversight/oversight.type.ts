export type SubjectType = {
  id: number;
  assign_teacher_name: string;
  subject_name: string;
  subject_code: string;
  subject_description: string;
  subject_photo: string;
  teacher_name: string;
  teacher_email: string;
  teacher_photo: string;
  room_number: string;
};

export type Lesson = {
  id: number;
  subject_id: number;
  lesson_name: string;
  lesson_description: string;
  lesson_file: string | null;
  lesson_url: string | null;
  lesson_type: string;
  start_date: string;
  end_date: string;
  allow_download: boolean;
};

type LessonUrl = {
  id: number;
  lesson_name: string;
  lesson_url: null | any;
  lesson_file: string;
};

export type Assessment = {
  id: number;
  activity_name: string;
  activity_type: number;
  activity_type_name: string;
  subject_id: number;
  start_time: string; // ISO string
  end_time: string; // ISO string
  show_score: boolean;
  max_score: number;
  passing_score: number;
  passing_score_type: "percentage" | "points"; // inferred; add more if needed
  time_duration: number;
  max_retake: number;
  retake_method: "highest" | string; // can refine if backend has strict choices
  activity_instruction: string;
  classroom_mode: boolean;
  shuffle_questions: boolean;
  student_retake_count: number;
  remaining_attempts: number;
  lesson_urls: LessonUrl[];
  attempts: any[];
  ongoing_attempt: any | null;
};

export type Student = {
  id: number;
  name: string;
  student_photo: string;
};
