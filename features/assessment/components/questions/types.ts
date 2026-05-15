export interface Question {
  id: number;
  activityId: string;
  questionText: string;
  questionInstruction: string;
  quizTypeId: number;
  score: number;
  correctAnswer: string;
  subjectId: number;
}

export interface Choice {
  id: number;
  questionId: number;
  choiceText: string;
  isLeftSide: boolean;
  subjectId?: number | null;
  choiceImage?: string | null;
}

export interface QuestionComponentProps {
  question: Question;
  currentAnswer: string;
  onAnswer: (questionId: number, answer: string) => void;
  disabled: boolean;
  currentUpload?: string;
  onUpload?: (questionId: number, fileUri: string) => void;
}

export interface MultipleChoiceProps extends QuestionComponentProps {
  choices: Choice[];
}

export interface MatchingProps extends QuestionComponentProps {
  choices: Choice[];
}
