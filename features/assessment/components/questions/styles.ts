import { StyleSheet } from "react-native";

export const questionStyles = StyleSheet.create({
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
  selectedOptionText: {
    color: "#fff",
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
  emptyChoices: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
    marginTop: 8,
  },
});
