import type { JwtPayload } from "jwt-decode";

export type LoginCredentials = {
  username: string;
  password: string;
};

export type AuthUser = {
  id: number;
  role: string;
  needs_password_setup: boolean;
  needs_onboarding: boolean;
};

export type AuthResponse = {
  access: string;
  refresh: string;
  access_expiry: number;
  refresh_expiry: number;
};

export type DecodedToken = JwtPayload & {
  user_id: number;
  role: string;
  needs_password_setup: boolean;
  needs_onboarding: boolean;
};
