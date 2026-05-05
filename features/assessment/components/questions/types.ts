export interface Question {
  id: number;
  activityId: number;
  questionText: string;
  questionInstruction: string;
  quizTypeId: number;
  score: number;
  correctAnswer: string;
  subjectId: number;
}

export interface Choice {
  id: number;
  activityId: number;
  questionId: number;
  choiceText: string;
  isLeftSide: string;
}

export interface QuestionComponentProps {
  question: Question;
  currentAnswer: string;
  onAnswer: (questionId: number, answer: string) => void;
  disabled: boolean;
}

export interface MultipleChoiceProps extends QuestionComponentProps {
  choices: Choice[];
}
