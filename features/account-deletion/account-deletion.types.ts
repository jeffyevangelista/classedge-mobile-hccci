export type AccountDeletionStatus =
  | "pending"
  | "scheduled"
  | "completed"
  | "cancelled";
export type AccountDeletionSource = "in_app" | "web_form" | "email";

export interface AccountDeletionResponse {
  id: string;
  submittedAt: string;
  status: AccountDeletionStatus;
  source: AccountDeletionSource;
  slaAcknowledgmentBusinessDays: number;
  slaCompletionDays: number;
}

export interface SubmitResult {
  response: AccountDeletionResponse;
  httpStatus: 200 | 201;
}

export interface OtpRequestResponse {
  expiresIn: number;
  expiresAt: string;
  resendIn: number;
  nextResendAllowedAt: string;
}

export type OtpErrorCode =
  | "otp_required"
  | "otp_invalid"
  | "otp_expired"
  | "otp_cooldown";
