import type { JwtPayload } from "jwt-decode";

export type LoginCredentials = {
  username: string;
  password: string;
};

export type AuthUser = {
  id: number;
  role: string;
  needsPasswordSetup: boolean;
  legalUpdateRequired: boolean;
  pendingLegalDocTypes: string[];
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  powersyncToken: string;
};

export type LegalDocument = {
  id: number;
  docType: string;
  version: string;
  title: string;
  content: string;
  effectiveDate: string;
};

export type ActiveLegalDocuments = {
  eula: LegalDocument | null;
  privacy: LegalDocument | null;
  nda: LegalDocument | null;
  missing: string[];
};

export type DecodedToken = JwtPayload & {
  userId: number;
  role: string;
  needsPasswordSetup: boolean;
  legalUpdateRequired: boolean;
  pendingLegalDocTypes: string[];
};
