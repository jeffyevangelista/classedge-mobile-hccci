// import { z } from "zod";

// const envSchema = z.object({
//   EXPO_PUBLIC_API_BASE_URL: z.url(),
//   EXPO_PUBLIC_API_URL: z.url(),
//   EXPO_PUBLIC_POWERSYNC_ENDPOINT: z.url(),
//   EXPO_PUBLIC_ACCESS_TOKEN_KEY: z.string(),
//   EXPO_PUBLIC_REFRESH_TOKEN_KEY: z.string(),
//   EXPO_PUBLIC_AUTH_USER_KEY: z.string(),
//   EXPO_PUBLIC_MICROSOFT_CLIENT_ID: z.string(),
//   EXPO_PUBLIC_MICROSOFT_TENANT_ID: z.string(),
// });

// const parsedEnv = envSchema.safeParse(process.env);

// if (!parsedEnv.success) {
//   console.error("Invalid environment variables:", parsedEnv.error.format());
//   throw new Error("Invalid environment variables. Check console for details.");
// }

// // Export the validated environment variables
// export const env = parsedEnv.data;

const EXPO_PUBLIC_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const EXPO_PUBLIC_API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api` || "";
const EXPO_PUBLIC_POWERSYNC_ENDPOINT =
  process.env.EXPO_PUBLIC_POWERSYNC_ENDPOINT || "";
const EXPO_PUBLIC_ACCESS_TOKEN_KEY =
  process.env.EXPO_PUBLIC_ACCESS_TOKEN_KEY || "";
const EXPO_PUBLIC_REFRESH_TOKEN_KEY =
  process.env.EXPO_PUBLIC_REFRESH_TOKEN_KEY || "";
const EXPO_PUBLIC_AUTH_USER_KEY = process.env.EXPO_PUBLIC_AUTH_USER_KEY || "";
const EXPO_PUBLIC_MICROSOFT_CLIENT_ID =
  process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || "";
const EXPO_PUBLIC_MICROSOFT_TENANT_ID =
  process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || "";
const EXPO_PUBLIC_ONESIGNAL_APP_ID =
  process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || "";

export const env = {
  EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_POWERSYNC_ENDPOINT,
  EXPO_PUBLIC_ACCESS_TOKEN_KEY,
  EXPO_PUBLIC_REFRESH_TOKEN_KEY,
  EXPO_PUBLIC_AUTH_USER_KEY,
  EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
  EXPO_PUBLIC_MICROSOFT_TENANT_ID,
  EXPO_PUBLIC_ONESIGNAL_APP_ID,
};
