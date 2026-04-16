import type { AuthResponse } from "./auth.types";
import { env } from "@/utils/env";
import axios from "axios";
import { snakeToCamel } from "@/lib/case-transform";

// Separated refresh endpoint from authApi.ts because of the warning below:
// Require cycle: api/authApi.ts -> api/index.ts -> api/authApi.ts
// Require cycles are allowed, but can result in uninitialized values. Consider refactoring to remove the need for a cycle.
export const refresh = async (
  refreshToken: string | null,
): Promise<AuthResponse> => {
  const data = (
    await axios.post(`${env.EXPO_PUBLIC_API_URL}/auth/refresh/`, {
      refresh: refreshToken,
    })
  ).data;
  return snakeToCamel<AuthResponse>(data);
};
