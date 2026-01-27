import type { JwtPayload } from "jwt-decode";

export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: number;
  role: string;
  needsPasswordSetup: boolean;
  needsOnboarding: boolean;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

export type DecodedToken = JwtPayload & {
  id: number;
  role: string;
  needsPasswordSetup: boolean;
  needsOnboarding: boolean;
};
