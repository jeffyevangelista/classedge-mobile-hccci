import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
} from "react-native";
import React, { useState, useEffect, useCallback } from "react";
import {
  useGetOrderedQuestions,
  useGetAnswersForAttempt,
} from "../assessment.hooks";
import { saveAnswer } from "../assessment.service";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "heroui-native";

interface Question {
  id: number;
  activityId: number;
  questionText: string;
  questionInstruction: string;
  quizTypeId: number;
  score: number;
  correctAnswer: string;
  subjectId: number;
}

interface QuestionComponentProps {
  question: Question;
  currentAnswer: string;
  onAnswer: (questionId: number, answer: string) => void;
  disabled: boolean;
}

const MultipleChoiceQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const options = ["Option A", "Option B", "Option C", "Option D"];

  const handleSelect = (index: number) => {
    if (disabled) return;
    const answer = index.toString();
    onAnswer(question.id, answer);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      {options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.optionButton,
            currentAnswer === index.toString() && styles.selectedOption,
          ]}
          onPress={() => handleSelect(index)}
          disabled={disabled}
        >
          <AppText>{option}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const EssayQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <TextInput
        style={styles.essayInput}
        multiline
        numberOfLines={6}
        placeholder="Type your answer here..."
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

const TrueFalseQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const handleSelect = (value: string) => {
    if (disabled) return;
    onAnswer(question.id, value);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <View style={styles.trueFalseContainer}>
        <TouchableOpacity
          style={[
            styles.trueFalseButton,
            currentAnswer === "True" && styles.selectedOption,
          ]}
          onPress={() => handleSelect("True")}
          disabled={disabled}
        >
          <AppText>True</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.trueFalseButton,
            currentAnswer === "False" && styles.selectedOption,
          ]}
          onPress={() => handleSelect("False")}
          disabled={disabled}
        >
          <AppText>False</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const FillInTheBlankQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <TextInput
        style={styles.fillBlankInput}
        placeholder="Fill in the blank..."
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

const MatchingQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <AppText style={styles.instructionText}>
        Format: "1 -&gt; 2" (match items)
      </AppText>
      <TextInput
        style={styles.fillBlankInput}
        placeholder="e.g., 1 -> 2"
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

const NumericQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <TextInput
        style={styles.fillBlankInput}
        placeholder="Enter numeric answer..."
        keyboardType="numeric"
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

const ImageBasedQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      {question.questionInstruction && (
        <Image
          source={{ uri: question.questionInstruction }}
          style={styles.questionImage}
          resizeMode="contain"
        />
      )}
      <TextInput
        style={styles.essayInput}
        multiline
        numberOfLines={4}
        placeholder="Type your answer based on the image..."
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

const QuestionRenderer = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  switch (question.quizTypeId) {
    case 1:
      return (
        <MultipleChoiceQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 2:
      return (
        <EssayQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 3:
      return (
        <TrueFalseQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 4:
      return (
        <FillInTheBlankQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 5:
      return (
        <MatchingQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 6:
      return (
        <NumericQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 7:
      return (
        <ImageBasedQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    default:
      return (
        <View style={styles.questionContainer}>
          <AppText>Unknown question type</AppText>
        </View>
      );
  }
};

type QuestionListProps = {
  activityId: number;
  attemptId: string;
  retakeRecordId: string;
  studentId: number;
  questionOrder: number[];
  initialIndex: number;
  onIndexChange: (index: number) => void;
  isTimeUp: boolean;
};

const QuestionList = ({
  activityId,
  attemptId,
  retakeRecordId,
  studentId,
  questionOrder,
  initialIndex,
  onIndexChange,
  isTimeUp,
}: QuestionListProps) => {
  const {
    data: questions,
    isLoading,
    isError,
    error,
  } = useGetOrderedQuestions(activityId, questionOrder);

  const { data: existingAnswers } = useGetAnswersForAttempt(attemptId);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(initialIndex);

  // Populate answers from existing records on load / re-entry
  useEffect(() => {
    if (!existingAnswers) return;
    const restored: Record<number, string> = {};
    for (const a of existingAnswers) {
      restored[a.activityQuestionId] = a.studentAnswer;
    }
    setAnswers(restored);
  }, [existingAnswers]);

  const handleAnswer = useCallback(
    (questionId: number, answer: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      // Persist immediately
      saveAnswer(retakeRecordId, questionId, studentId, answer).catch((err) =>
        console.error("[QuestionList] Failed to save answer:", err),
      );
    },
    [retakeRecordId, studentId],
  );

  const handleNextPage = () => {
    if (questions && currentPage < questions.length - 1) {
      const next = currentPage + 1;
      setCurrentPage(next);
      onIndexChange(next);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      onIndexChange(prev);
    }
  };

  if (isLoading) return <QuestionListSkeleton />;

  if (isError)
    return (
      <ErrorFallback message={error?.message ?? "Failed to load questions"} />
    );

  if (!questions || questions.length === 0) {
    return (
      <EmptyState
        icon="ClipboardTextIcon"
        title="No questions available"
        description="This assessment has no questions yet"
      />
    );
  }

  const currentQuestion = questions[currentPage];
  const totalQuestions = questions.length;

  return (
    <View style={styles.paginationContainer}>
      {isTimeUp && (
        <View style={styles.timeUpBanner}>
          <AppText style={styles.timeUpText}>Time is up! Submitting...</AppText>
        </View>
      )}
      <ScrollView
        style={styles.questionScrollView}
        pointerEvents={isTimeUp ? "none" : "auto"}
      >
        <View style={styles.currentQuestionContainer}>
          <AppText style={styles.questionNumber}>
            Question {currentPage + 1} of {totalQuestions}
          </AppText>
          <QuestionRenderer
            question={currentQuestion}
            currentAnswer={answers[currentQuestion.id] ?? ""}
            onAnswer={handleAnswer}
            disabled={isTimeUp}
          />
        </View>
      </ScrollView>

      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[
            styles.navButton,
            (currentPage === 0 || isTimeUp) && styles.navButtonDisabled,
          ]}
          onPress={handlePreviousPage}
          disabled={currentPage === 0 || isTimeUp}
        >
          <AppText
            style={[
              styles.navButtonText,
              (currentPage === 0 || isTimeUp) && styles.navButtonTextDisabled,
            ]}
          >
            Previous
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            (currentPage === totalQuestions - 1 || isTimeUp) &&
              styles.navButtonDisabled,
          ]}
          onPress={handleNextPage}
          disabled={currentPage === totalQuestions - 1 || isTimeUp}
        >
          <AppText
            style={[
              styles.navButtonText,
              (currentPage === totalQuestions - 1 || isTimeUp) &&
                styles.navButtonTextDisabled,
            ]}
          >
            Next
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  paginationContainer: {
    flex: 1,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 3,
  },
  questionScrollView: {
    flex: 1,
  },
  currentQuestionContainer: {
    padding: 16,
  },
  questionContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  questionText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  scoreText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
    fontStyle: "italic",
  },
  optionButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  trueFalseContainer: {
    flexDirection: "row",
    gap: 12,
  },
  trueFalseButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    alignItems: "center",
  },
  essayInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    minHeight: 100,
    textAlignVertical: "top",
  },
  fillBlankInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
  },
  questionImage: {
    width: "100%",
    height: 200,
    marginBottom: 12,
    borderRadius: 6,
  },
  navigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 12,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  navButtonDisabled: {
    backgroundColor: "#e0e0e0",
  },
  navButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  navButtonTextDisabled: {
    color: "#999",
  },
  pageIndicatorContainer: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
    flex: 1,
  },
  pageIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  pageIndicatorActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  pageIndicatorAnswered: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  pageIndicatorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  pageIndicatorTextActive: {
    color: "#fff",
  },
  timeUpBanner: {
    backgroundColor: "#FF3B30",
    padding: 12,
    alignItems: "center",
  },
  timeUpText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});

const QuestionListSkeleton = () => {
  return (
    <View style={styles.paginationContainer}>
      <View style={styles.currentQuestionContainer}>
        <Skeleton className="h-6 w-40 rounded mb-3" />
        <View style={styles.questionContainer}>
          <Skeleton className="h-5 w-full rounded mb-2" />
          <Skeleton className="h-3 w-20 rounded mb-3" />
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-md mb-2" />
            ))}
        </View>
      </View>
      <View style={styles.navigationContainer}>
        <Skeleton className="h-12 w-24 rounded-lg" />
        <Skeleton className="h-12 w-24 rounded-lg" />
      </View>
    </View>
  );
};

export default QuestionList;
