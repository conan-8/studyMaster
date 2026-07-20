"use client";

import { useActionState } from "react";
import { logout, type LogoutState } from "@/lib/actions/auth";

const initialState: LogoutState = {};

export function LogoutButton() {
  const [state, formAction, pending] = useActionState(logout, initialState);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing out..." : "Log out"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
