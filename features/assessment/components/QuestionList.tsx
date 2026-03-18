import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
} from "react-native";
import React, { useState } from "react";
import { useGetQuestions } from "../assessment.hooks";
import { AppText } from "@/components/AppText";

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
  onAnswer: (questionId: number, answer: string) => void;
}

const MultipleChoiceQuestion = ({
  question,
  onAnswer,
}: QuestionComponentProps) => {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const options = ["Option A", "Option B", "Option C", "Option D"];

  const handleSelect = (index: number) => {
    const answer = index.toString();
    setSelectedOption(answer);
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
            selectedOption === index.toString() && styles.selectedOption,
          ]}
          onPress={() => handleSelect(index)}
        >
          <AppText>{option}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const EssayQuestion = ({ question, onAnswer }: QuestionComponentProps) => {
  const [answer, setAnswer] = useState<string>("");

  const handleChange = (text: string) => {
    setAnswer(text);
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
        value={answer}
        onChangeText={handleChange}
      />
    </View>
  );
};

const TrueFalseQuestion = ({ question, onAnswer }: QuestionComponentProps) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");

  const handleSelect = (value: string) => {
    setSelectedAnswer(value);
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
            selectedAnswer === "True" && styles.selectedOption,
          ]}
          onPress={() => handleSelect("True")}
        >
          <AppText>True</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.trueFalseButton,
            selectedAnswer === "False" && styles.selectedOption,
          ]}
          onPress={() => handleSelect("False")}
        >
          <AppText>False</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const FillInTheBlankQuestion = ({
  question,
  onAnswer,
}: QuestionComponentProps) => {
  const [answer, setAnswer] = useState<string>("");

  const handleChange = (text: string) => {
    setAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <TextInput
        style={styles.fillBlankInput}
        placeholder="Fill in the blank..."
        value={answer}
        onChangeText={handleChange}
      />
    </View>
  );
};

const MatchingQuestion = ({ question, onAnswer }: QuestionComponentProps) => {
  const [matches, setMatches] = useState<string>("");

  const handleChange = (text: string) => {
    setMatches(text);
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
        value={matches}
        onChangeText={handleChange}
      />
    </View>
  );
};

const NumericQuestion = ({ question, onAnswer }: QuestionComponentProps) => {
  const [answer, setAnswer] = useState<string>("");

  const handleChange = (text: string) => {
    setAnswer(text);
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
        value={answer}
        onChangeText={handleChange}
      />
    </View>
  );
};

const ImageBasedQuestion = ({ question, onAnswer }: QuestionComponentProps) => {
  const [answer, setAnswer] = useState<string>("");

  const handleChange = (text: string) => {
    setAnswer(text);
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
        value={answer}
        onChangeText={handleChange}
      />
    </View>
  );
};

const QuestionRenderer = ({ question, onAnswer }: QuestionComponentProps) => {
  switch (question.quizTypeId) {
    case 1:
      return <MultipleChoiceQuestion question={question} onAnswer={onAnswer} />;
    case 2:
      return <EssayQuestion question={question} onAnswer={onAnswer} />;
    case 3:
      return <TrueFalseQuestion question={question} onAnswer={onAnswer} />;
    case 4:
      return <FillInTheBlankQuestion question={question} onAnswer={onAnswer} />;
    case 5:
      return <MatchingQuestion question={question} onAnswer={onAnswer} />;
    case 6:
      return <NumericQuestion question={question} onAnswer={onAnswer} />;
    case 7:
      return <ImageBasedQuestion question={question} onAnswer={onAnswer} />;
    default:
      return (
        <View style={styles.questionContainer}>
          <AppText>Unknown question type</AppText>
        </View>
      );
  }
};

const QuestionList = ({ activityId }: { activityId: number }) => {
  const {
    data: questions,
    isLoading,
    isError,
    error,
  } = useGetQuestions(activityId);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(0);

  const handleAnswer = (questionId: number, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleNextPage = () => {
    if (questions && currentPage < questions.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleGoToPage = (pageIndex: number) => {
    setCurrentPage(pageIndex);
  };

  if (isLoading) return <AppText>loading...</AppText>;

  if (isError) return <AppText>{error?.message}</AppText>;

  if (!questions || questions.length === 0) {
    return <AppText>No questions available</AppText>;
  }

  const currentQuestion = questions[currentPage];
  const totalQuestions = questions.length;

  return (
    <View style={styles.paginationContainer}>
      <ScrollView style={styles.questionScrollView}>
        <View style={styles.currentQuestionContainer}>
          <AppText style={styles.questionNumber}>
            Question {currentPage + 1} of {totalQuestions}
          </AppText>
          <QuestionRenderer
            question={currentQuestion}
            onAnswer={handleAnswer}
          />
        </View>
      </ScrollView>

      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[
            styles.navButton,
            currentPage === 0 && styles.navButtonDisabled,
          ]}
          onPress={handlePreviousPage}
          disabled={currentPage === 0}
        >
          <AppText
            style={[
              styles.navButtonText,
              currentPage === 0 && styles.navButtonTextDisabled,
            ]}
          >
            Previous
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            currentPage === totalQuestions - 1 && styles.navButtonDisabled,
          ]}
          onPress={handleNextPage}
          disabled={currentPage === totalQuestions - 1}
        >
          <AppText
            style={[
              styles.navButtonText,
              currentPage === totalQuestions - 1 &&
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
});

export default QuestionList;
