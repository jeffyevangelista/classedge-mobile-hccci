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
  access_token: string;
  refresh_token: string;
  powersync_token: string;
};

export type DecodedToken = JwtPayload & {
  user_id: number;
  role: string;
  needs_password_setup: boolean;
  needs_onboarding: boolean;
};
