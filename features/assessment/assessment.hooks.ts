import { useQuery } from "@powersync/tanstack-react-query";
import {
  getAssessmentAttempt,
  getAssessmentDetails,
  getAttemptRecords,
  getQuestions,
  getOrderedQuestions,
  getAnswersForAttempt,
  getChoicesForActivity,
  getOngoingAttempt,
  getQuestionTypes,
  getQuestionCount,
} from "./assessment.service";

export const useAssessmentDetails = ({
  userId,
  assessmentId,
}: {
  userId: number;
  assessmentId: string;
}) => {
  return useQuery({
    queryKey: ["assessment-details", assessmentId, userId],
    queryFn: () => getAssessmentDetails(assessmentId, userId),
    enabled: !!assessmentId && assessmentId !== "undefined" && !!userId,
  });
};

export const useAttemptRecords = (
  studentActivityId: string,
  studentId: number,
) => {
  return useQuery({
    queryKey: ["retake-records", studentActivityId, studentId],
    queryFn: () => getAttemptRecords(studentActivityId, studentId),
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

export const useGetQuestions = (activityId: string) => {
  return useQuery({
    queryKey: ["questions", activityId],
    queryFn: () => getQuestions(activityId),
  });
};

export const useGetOrderedQuestions = (
  activityId: string,
  questionOrder: number[],
) => {
  return useQuery({
    queryKey: ["ordered-questions", activityId, questionOrder],
    queryFn: () => getOrderedQuestions(activityId, questionOrder),
    enabled:
      !!activityId &&
      Array.isArray(questionOrder) &&
      questionOrder.length > 0,
  });
};

export const useGetAnswersForAttempt = (retakeRecordId: string) => {
  return useQuery({
    queryKey: ["attempt-answers", retakeRecordId],
    queryFn: () => getAnswersForAttempt(retakeRecordId),
    enabled: !!retakeRecordId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useChoicesForActivity = (activityId: string) => {
  return useQuery({
    queryKey: ["activity-choices", activityId],
    queryFn: () => getChoicesForActivity(activityId),
    enabled: !!activityId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useOngoingAttempt = (
  studentActivityId?: string,
  studentId?: number,
) => {
  return useQuery({
    queryKey: ["ongoing-attempt", studentActivityId, studentId],
    queryFn: () => getOngoingAttempt(studentActivityId!, studentId!),
    enabled: !!studentActivityId && !!studentId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useQuestionTypes = () => {
  return useQuery({
    queryKey: ["question-types"],
    queryFn: () => getQuestionTypes(),
    staleTime: 1000 * 60 * 60,
  });
};

export const useQuestionCount = (activityId: string | undefined) => {
  return useQuery({
    queryKey: ["question-count", activityId],
    queryFn: () => getQuestionCount(activityId!),
    enabled: !!activityId,
    staleTime: 1000 * 60 * 5,
  });
};
