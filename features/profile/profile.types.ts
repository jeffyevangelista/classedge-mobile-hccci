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

export type FinancialStudent = {
  id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  name_extension: string;
  school_email: string | null;
  email: string;
};

export type AcademicTerm = {
  id: number;
  academic_term_code: string;
  semester: string;
  year_level: string;
};

export type Tuition = {
  total_amount: string;
  balance: string;
  amount_paid: number;
};

export type MiscellaneousFee = {
  fee_item_name: string;
  final_cost: string;
};

export type SubjectFee = {
  subject_name: string;
  final_cost: string;
};

export type GrantedScholarship = {
  scholarship_name: string;
  tuition_amount: string;
  date_granted: string;
};

export type FinancialRecord = {
  student: FinancialStudent;
  academic_term: AcademicTerm;
  tuition: Tuition;
  miscellaneous_fees: MiscellaneousFee[];
  subject_fees: SubjectFee[];
  granted_scholarships: GrantedScholarship[];
};

export type FinancialRecordResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: FinancialRecord[];
};
