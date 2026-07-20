import { describe, it, expect } from "vitest";
import { userSchema } from "@/lib/validation";

describe("userSchema", () => {
  it("accepts a valid email and name", () => {
    const result = userSchema.safeParse({
      email: "test@example.com",
      name: "Jane Doe",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
      expect(result.data.name).toBe("Jane Doe");
    }
  });

  it("rejects an invalid email", () => {
    const result = userSchema.safeParse({
      email: "not-an-email",
      name: "John",
    });
    expect(result.success).toBe(false);
  });

  it("requires both fields", () => {
    const result = userSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
