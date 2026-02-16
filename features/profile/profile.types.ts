type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type ClassSchedule = {
  id: number;
  subject_id: number;
  subject_name: string;
  schedule_start_time: string;
  schedule_end_time: string;
  assign_teacher: string;
  room: string;
  days_of_week: DayOfWeek[];
  teacher_photo: string;
};
