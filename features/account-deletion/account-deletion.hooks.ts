import { useMutation } from "@tanstack/react-query";
import {
  requestDeletionOTP,
  submitAccountDeletionRequest,
} from "./account-deletion.api";
import type { OtpRequestResponse, SubmitResult } from "./account-deletion.types";

export function useRequestDeletionOTP() {
  return useMutation<OtpRequestResponse>({
    mutationFn: requestDeletionOTP,
  });
}

export function useSubmitAccountDeletionRequest() {
  return useMutation<SubmitResult, unknown, { otp: string; reason?: string }>({
    mutationFn: ({ otp, reason }) => submitAccountDeletionRequest(otp, reason),
  });
}
