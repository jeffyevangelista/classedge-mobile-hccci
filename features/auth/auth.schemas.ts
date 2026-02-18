import { z } from "zod";

const emailSchema = z
  .email("Please enter a valid email")
  .refine((val) => val.toLowerCase().endsWith("@hccci.edu.ph"), {
    message: "Email must end with @hccci.edu.ph",
  })
  .min(1, "Email is required");

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const confirmPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "At least 12 characters")
      .regex(/[A-Z]/, "Must include an uppercase letter")
      .regex(/[a-z]/, "Must include a lowercase letter")
      .regex(/[0-9]/, "Must include a number")
      .regex(/[^A-Za-z0-9]/, "Must include a symbol"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ForgotPasswordFormvalues = z.infer<typeof forgotPasswordSchema>;
export type ConfirmPasswordFormValues = z.infer<typeof confirmPasswordSchema>;
