import { api } from "@/lib/axios";
import type { LoginCredentials } from "./auth.types";

export const login = async (loginCredentials: LoginCredentials) => {
  return (await api.post("/auth/login", loginCredentials)).data;
};

export const getPowerSyncToken = async () => {
  return (await api.post("/auth/powersync-token")).data;
};
