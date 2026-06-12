import type { Choice, Question } from "../questions/types";

export interface ResultProps {
  question: Question;
  studentAnswer: string;
  uploadedFile?: string;
  isRevealed: boolean;
  choices: Choice[];
}
