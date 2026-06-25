import api from "@/lib/axios";
import type {
  AccountDeletionResponse,
  OtpRequestResponse,
  SubmitResult,
} from "./account-deletion.types";

export async function requestDeletionOTP(): Promise<OtpRequestResponse> {
  const r = await api.post<OtpRequestResponse>(
    "/account/deletion-request/otp/",
    {},
  );
  return r.data;
}

export async function submitAccountDeletionRequest(
  otp: string,
  reason?: string,
): Promise<SubmitResult> {
  const trimmed = reason?.trim() || undefined;
  const response = await api.post<AccountDeletionResponse>(
    "/account/deletion-request/",
    {
      reason: trimmed,
      otp,
      source: "in_app",
    },
  );
  return {
    response: response.data,
    httpStatus: response.status as 200 | 201,
  };
}
