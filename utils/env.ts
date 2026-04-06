import { z } from "zod";

const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z
    .string()
    .url("EXPO_PUBLIC_API_URL must be a valid URL"),
  EXPO_PUBLIC_POWERSYNC_ENDPOINT: z
    .string()
    .url("EXPO_PUBLIC_POWERSYNC_ENDPOINT must be a valid URL"),
  EXPO_PUBLIC_ACCESS_TOKEN_KEY: z
    .string()
    .min(1, "EXPO_PUBLIC_ACCESS_TOKEN_KEY is required"),
  EXPO_PUBLIC_REFRESH_TOKEN_KEY: z
    .string()
    .min(1, "EXPO_PUBLIC_REFRESH_TOKEN_KEY is required"),
  EXPO_PUBLIC_AUTH_USER_KEY: z
    .string()
    .min(1, "EXPO_PUBLIC_AUTH_USER_KEY is required"),
  EXPO_PUBLIC_MICROSOFT_CLIENT_ID: z
    .string()
    .min(1, "EXPO_PUBLIC_MICROSOFT_CLIENT_ID is required"),
  EXPO_PUBLIC_MICROSOFT_TENANT_ID: z
    .string()
    .min(1, "EXPO_PUBLIC_MICROSOFT_TENANT_ID is required"),
  EXPO_PUBLIC_ONESIGNAL_APP_ID: z
    .string()
    .min(1, "EXPO_PUBLIC_ONESIGNAL_APP_ID is required"),
});

const result = envSchema.safeParse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_POWERSYNC_ENDPOINT: process.env.EXPO_PUBLIC_POWERSYNC_ENDPOINT,
  EXPO_PUBLIC_ACCESS_TOKEN_KEY: process.env.EXPO_PUBLIC_ACCESS_TOKEN_KEY,
  EXPO_PUBLIC_REFRESH_TOKEN_KEY: process.env.EXPO_PUBLIC_REFRESH_TOKEN_KEY,
  EXPO_PUBLIC_AUTH_USER_KEY: process.env.EXPO_PUBLIC_AUTH_USER_KEY,
  EXPO_PUBLIC_MICROSOFT_CLIENT_ID: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
  EXPO_PUBLIC_MICROSOFT_TENANT_ID: process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID,
  EXPO_PUBLIC_ONESIGNAL_APP_ID: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,
});

if (!result.success) {
  const formatted = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(`\n❌ Invalid environment variables:\n${formatted}\n`);
  throw new Error(
    "Missing or invalid environment variables. See console for details.",
  );
}

const validated = result.data;

export const env = {
  EXPO_PUBLIC_API_BASE_URL: validated.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_API_URL: `${validated.EXPO_PUBLIC_API_URL}/api`,
  EXPO_PUBLIC_POWERSYNC_ENDPOINT: validated.EXPO_PUBLIC_POWERSYNC_ENDPOINT,
  EXPO_PUBLIC_ACCESS_TOKEN_KEY: validated.EXPO_PUBLIC_ACCESS_TOKEN_KEY,
  EXPO_PUBLIC_REFRESH_TOKEN_KEY: validated.EXPO_PUBLIC_REFRESH_TOKEN_KEY,
  EXPO_PUBLIC_AUTH_USER_KEY: validated.EXPO_PUBLIC_AUTH_USER_KEY,
  EXPO_PUBLIC_MICROSOFT_CLIENT_ID: validated.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
  EXPO_PUBLIC_MICROSOFT_TENANT_ID: validated.EXPO_PUBLIC_MICROSOFT_TENANT_ID,
  EXPO_PUBLIC_ONESIGNAL_APP_ID: validated.EXPO_PUBLIC_ONESIGNAL_APP_ID,
};
