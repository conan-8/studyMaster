import { describe, it, expect } from "vitest";
import { mapAuthError } from "@/lib/auth-errors";

describe("mapAuthError", () => {
  it("maps invalid credentials to a friendly message", () => {
    expect(mapAuthError("Invalid login credentials")).toBe(
      "Incorrect email or password.",
    );
  });

  it("maps unconfirmed email to a confirmation prompt", () => {
    expect(mapAuthError("Email not confirmed")).toBe(
      "Please confirm your email before signing in.",
    );
  });

  it("maps already-registered errors", () => {
    expect(mapAuthError("User already registered")).toBe(
      "An account with this email already exists. Try signing in.",
    );
    expect(mapAuthError("User already exists")).toBe(
      "An account with this email already exists. Try signing in.",
    );
  });

  it("maps rate limit errors", () => {
    expect(mapAuthError("Rate limit exceeded")).toBe(
      "Too many attempts. Please try again later.",
    );
    expect(mapAuthError("Too many requests")).toBe(
      "Too many attempts. Please try again later.",
    );
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(mapAuthError("Some unexpected error")).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("is case-insensitive", () => {
    expect(mapAuthError("INVALID LOGIN CREDENTIALS")).toBe(
      "Incorrect email or password.",
    );
  });
});
