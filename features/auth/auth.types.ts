import type { JwtPayload } from "jwt-decode";

export type LoginCredentials = {
  username: string;
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
  powersyncToken: string;
};

export type DecodedToken = JwtPayload & {
  userId: number;
  role: string;
  needsPasswordSetup: boolean;
  needsOnboarding: boolean;
};
