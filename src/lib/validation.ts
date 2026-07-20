import { z } from "zod";

// Reserved for a future profile/name feature. A unit test depends on this exact
// shape, so keep it unchanged.
export const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  ageConfirm: z.literal("true", {
    errorMap: () => ({
      message: "You must confirm that you are 13 or older to create an account.",
    }),
  }),
});
