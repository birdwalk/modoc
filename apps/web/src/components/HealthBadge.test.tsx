import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HealthBadge } from "./HealthBadge";

afterEach(cleanup);

describe("HealthBadge", () => {
  it("renders a 100 percent score", () => {
    render(<HealthBadge score={100} />);
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("%")).toBeTruthy();
    expect(screen.getByText("Excellent")).toBeTruthy();
  });

  it("leaves part of the track unfilled for 90 percent", () => {
    render(<HealthBadge score={90} />);
    const progress = screen.getByTestId("health-progress-ring");
    expect(Number(progress.getAttribute("data-dashoffset"))).toBeGreaterThan(0);
  });
});
