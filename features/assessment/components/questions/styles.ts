import { StyleSheet } from "react-native";

export const questionStyles = StyleSheet.create({
  questionContainer: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  questionText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  scoreText: {
    fontSize: 12,
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: "italic",
  },
  optionButton: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 8,
  },
  selectedOption: {},
  selectedOptionText: {},
  trueFalseContainer: {
    flexDirection: "row",
    gap: 12,
  },
  trueFalseButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: "center",
  },
  essayInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    minHeight: 140,
    textAlignVertical: "top",
  },
  fillBlankInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
  },
  questionImage: {
    width: "100%",
    height: 200,
    marginBottom: 12,
    borderRadius: 6,
  },
  emptyChoices: {
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 8,
  },
});
