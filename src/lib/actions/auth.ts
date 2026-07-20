"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loginSchema, signupSchema } from "@/lib/validation";
import { mapAuthError } from "@/lib/auth-errors";

export type AuthFieldErrors = {
  email?: string;
  password?: string;
  ageConfirm?: string;
};

export type AuthState = {
  error?: string;
  message?: string;
  fieldErrors?: AuthFieldErrors;
};

export type LogoutState = { error?: string };

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const result = loginSchema.safeParse({ email, password });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  if (data.user) {
    const userEmail = data.user.email ?? result.data.email;
    try {
      await prisma.user.upsert({
        where: { id: data.user.id },
        update: { email: userEmail },
        create: { id: data.user.id, email: userEmail },
      });
    } catch (err) {
      console.error("Failed to upsert user profile on login", err);
    }
  }

  redirect("/app");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const result = signupSchema.safeParse({
    email,
    password,
    ageConfirm: formData.get("ageConfirm") ?? "",
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        ageConfirm: fieldErrors.ageConfirm?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  if (data.user) {
    const userEmail = data.user.email ?? result.data.email;
    try {
      await prisma.user.upsert({
        where: { id: data.user.id },
        update: { email: userEmail },
        create: { id: data.user.id, email: userEmail },
      });
    } catch (err) {
      console.error("Failed to upsert user profile on signup", err);
      return {
        message:
          "Account created, but we couldn't finish setting up your profile. You can still sign in.",
      };
    }
  }

  if (data.session) {
    redirect("/app");
  }

  return {
    message: "Account created. Check your email to confirm your address.",
  };
}

export async function logout(_prev: LogoutState): Promise<LogoutState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: "Could not sign out. Please try again." };
  redirect("/login");
}
