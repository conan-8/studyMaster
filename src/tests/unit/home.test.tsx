import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the StudyMate heading", () => {
    render(<Home />);
    const heading = screen.getByRole("heading", { name: /studymate/i });
    expect(heading).toBeInTheDocument();
  });

  it("renders the description paragraph", () => {
    render(<Home />);
    expect(
      screen.getByText(/intelligent exam preparation platform/i)
    ).toBeInTheDocument();
  });
});
