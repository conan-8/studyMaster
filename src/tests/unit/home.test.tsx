import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("redirects to the exam frontend", () => {
    let caught: unknown;
    try {
      render(<Home />);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    const digest =
      (caught as { digest?: string }).digest ?? String(
        (caught as Error).message ?? caught,
      );
    expect(digest).toContain("NEXT_REDIRECT");
    expect(digest).toContain("/exam");
  });
});
