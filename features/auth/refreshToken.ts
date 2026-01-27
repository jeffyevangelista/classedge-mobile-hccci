import { API_URL } from "@/utils/env";
import axios from "axios";

// Separated refresh endpoint from authApi.ts because of the warning below:
// Require cycle: api/authApi.ts -> api/index.ts -> api/authApi.ts
// Require cycles are allowed, but can result in uninitialized values. Consider refactoring to remove the need for a cycle.
export const refresh = async (refreshToken: string | null) => {
  return (await axios.post(`${API_URL}/auth/refresh`, { refreshToken })).data;
};
