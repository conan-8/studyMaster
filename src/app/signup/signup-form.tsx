"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthState } from "@/lib/actions/auth";
import { TextInput } from "@/components/text-input";

const initialState: AuthState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <TextInput
        id="email"
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        error={state.fieldErrors?.email}
      />

      <TextInput
        id="password"
        name="password"
        label="Password"
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        placeholder="At least 6 characters"
        error={state.fieldErrors?.password}
      />

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <input
            id="ageConfirm"
            name="ageConfirm"
            type="checkbox"
            required
            value="true"
            aria-invalid={state.fieldErrors?.ageConfirm ? true : undefined}
            aria-describedby={
              state.fieldErrors?.ageConfirm ? "ageConfirm-error" : undefined
            }
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-950 accent-white"
          />
          <label htmlFor="ageConfirm" className="text-sm text-slate-300">
            I am 13 or older
          </label>
        </div>
        {state.fieldErrors?.ageConfirm ? (
          <p id="ageConfirm-error" role="alert" className="text-sm text-red-400">
            {state.fieldErrors.ageConfirm}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <div aria-live="polite" role="status">
        {state.message ? (
          <p className="text-sm text-emerald-400">{state.message}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-white px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-white underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
