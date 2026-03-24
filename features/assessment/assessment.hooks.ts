import { useQuery } from "@powersync/tanstack-react-query";
import {
  getAssessmentAttempt,
  getAssessmentDetails,
  getAttemptRecords,
  getQuestions,
  getOrderedQuestions,
  getAnswersForAttempt,
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

export const useGetAssessmentAttempt = (localId: string) => {
  return useQuery({
    queryKey: ["assessment-attempt", localId],
    queryFn: () => getAssessmentAttempt(localId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
};

export const useGetQuestions = (activityId: number) => {
  return useQuery({
    queryKey: ["questions", activityId],
    queryFn: () => getQuestions(activityId),
  });
};

export const useGetOrderedQuestions = (
  activityId: number,
  questionOrder: number[],
) => {
  return useQuery({
    queryKey: ["ordered-questions", activityId, questionOrder],
    queryFn: () => getOrderedQuestions(activityId, questionOrder),
    enabled: !!activityId && questionOrder.length > 0,
  });
};

export const useGetAnswersForAttempt = (retakeRecordId: string) => {
  return useQuery({
    queryKey: ["attempt-answers", retakeRecordId],
    queryFn: () => getAnswersForAttempt(retakeRecordId),
    enabled: !!retakeRecordId,
  });
};
