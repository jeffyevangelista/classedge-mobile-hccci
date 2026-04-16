type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type ClassSchedule = {
  id: number;
  subjectId: number;
  subjectName: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  assignTeacher: string;
  room: string;
  daysOfWeek: DayOfWeek[];
  teacherPhoto: string;
};

export type FinancialStudent = {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
  nameExtension: string;
  schoolEmail: string | null;
  email: string;
};

export type AcademicTerm = {
  id: number;
  academicTermCode: string;
  semester: string;
  yearLevel: string;
};

export type Tuition = {
  totalAmount: string;
  balance: string;
  amountPaid: number;
};

export type MiscellaneousFee = {
  feeItemName: string;
  finalCost: string;
};

export type SubjectFee = {
  subjectName: string;
  finalCost: string;
};

export type GrantedScholarship = {
  scholarshipName: string;
  tuitionAmount: string;
  dateGranted: string;
};

export type FinancialRecord = {
  student: FinancialStudent;
  academicTerm: AcademicTerm;
  tuition: Tuition;
  miscellaneousFees: MiscellaneousFee[];
  subjectFees: SubjectFee[];
  grantedScholarships: GrantedScholarship[];
};

export type FinancialRecordResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: FinancialRecord[];
};
