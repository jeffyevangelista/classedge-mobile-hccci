export type TimelineItem = {
  id: string;
  fileName: string;
  startDate: string;
  type: "material" | "assessment";
  hasSubmission: number;
  showScore: number;
  maxScore: number;
  totalScore: number;
  classroomMode: number;
};

export type Filter = "all" | "assessment" | "material";

export type BucketKey = "upcoming" | "today" | "thisWeek" | "earlier";

export type TimelineRowHighlight = "today" | "due-soon" | "overdue";
