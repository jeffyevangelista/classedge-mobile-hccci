export type ArchivedCourse = {
  id: number;
  enrollmentId: number | null;
  subjectName: string;
  subjectCode: string;
  subjectPhoto: string | null;
  roomNumber: string | null;
  teacherName: string | null;
  isCoil: boolean;
  isHali: boolean;
  isCte: boolean;
};

export type ArchivedSemester = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
};

export type ArchivedSemesterGroup = {
  semester: ArchivedSemester;
  courses: ArchivedCourse[];
};

export type ArchivedCoursesPage = {
  results: ArchivedSemesterGroup[];
  pagination: {
    page: number;
    pageSize: number;
    totalSemesters: number;
    hasNext: boolean;
  };
};
