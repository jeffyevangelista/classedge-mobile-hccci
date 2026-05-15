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

export type PromissoryNote = {
  id: number;
  promisoryNoteUrl: string;
  date: string;
  academicTermCode: string;
  notes: string;
};

export type OtherFee = {
  name: string;
  originalCost: number;
  finalCost: number;
  discountAmount: number;
};

export type PaymentReceipt = {
  receiptNumber: string;
  receiptDate: string;
  amount: number;
  paymentMethod: string;
  cashier: string;
};

export type DiscountSummary = {
  subjectDiscountTotal: number;
  miscDiscountTotal: number;
  otherDiscountTotal: number;
  totalFeeDiscounts: number;
};

export type FinancialRecord = {
  student: FinancialStudent;
  academicTerm: AcademicTerm;
  tuition: Tuition;
  miscellaneousFees: MiscellaneousFee[];
  subjectFees: SubjectFee[];
  grantedScholarships: GrantedScholarship[];
  promissoryNotes: PromissoryNote[];
  otherFees: OtherFee[];
  paymentReceipts: PaymentReceipt[];
  discountSummary: DiscountSummary;
};

export type FinancialRecordResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: FinancialRecord[];
};

export type AcademicSubject = {
  subjectName: string;
  transmutedGrade: number | null;
  breakdown: {
    final: number;
    terms: Record<string, number>;
  };
};

export type AcademicRecordTerm = {
  studentId: number;
  studentName: string;
  studentSchoolEmail: string;
  academicTermCode: string;
  subjects: AcademicSubject[];
};

export type AcademicRecordsResponse = AcademicRecordTerm[];

export type AcademicTermItem = {
  id: number;
  academicTermCode: string;
  schoolYear: string;
  semester: string;
  startDate: string;
  endDate: string;
  currentSemester: boolean;
  isClosed: boolean;
};
