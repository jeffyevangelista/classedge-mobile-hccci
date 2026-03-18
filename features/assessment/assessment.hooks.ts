import { useQuery } from "@powersync/tanstack-react-query";
import {
  getAssessmentAttempt,
  getAssessmentDetails,
  getAttemptRecords,
  getQuestions,
  startAssessmentAttempt,
} from "./assessment.services";

export const useAssessmentDetails = ({
  userId,
  assessmentId,
}: {
  userId: number;
  assessmentId: string;
}) => {
  return useQuery({
    queryKey: ["assessment-details", assessmentId, userId],
    queryFn: () => getAssessmentDetails(Number(assessmentId), userId),
    enabled: !!assessmentId && assessmentId !== "undefined" && !!userId,
  });
};

export const useAttemptRecords = (activityId: number, studentId: number) => {
  return useQuery({
    queryKey: ["retake-records", activityId, studentId],
    queryFn: () => getAttemptRecords(activityId, studentId),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useStartAssessmentAttempt = ({
  studentActivityId,
  studentId,
  duration,
  retakeNumber,
  maxRetakes,
  ActivityId,
}: {
  studentActivityId: number;
  studentId: number;
  duration: number;
  retakeNumber: number;
  maxRetakes: number;
  ActivityId: number;
}) => {
  return useQuery({
    queryKey: [
      "start-assessment-attempt",
      studentActivityId,
      studentId,
      duration,
      retakeNumber,
    ],
    queryFn: async () => {
      const existingAttempts = await getAttemptRecords(
        studentActivityId,
        studentId,
      );

      if (existingAttempts.length >= maxRetakes) {
        throw new Error("Maximum number of retakes reached");
      }

      if (existingAttempts.length > 0) {
        return startAssessmentAttempt(
          studentActivityId,
          studentId,
          duration,
          existingAttempts.length + 1,
          ActivityId,
        );
      }

      return startAssessmentAttempt(
        studentActivityId,
        studentId,
        duration,
        retakeNumber,
        ActivityId,
      );
    },
  });
};

export const useGetAssessmentAttempt = (localId: string) => {
  return useQuery({
    queryKey: ["assessment-attempt", localId],
    queryFn: () => getAssessmentAttempt(localId),
    staleTime: 1000 * 60 * 5, // Keep data fresh for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });
};

export const useGetQuestions = (activityId: number) => {
  return useQuery({
    queryKey: ["questions", activityId],
    queryFn: () => getQuestions(activityId),
  });
};
