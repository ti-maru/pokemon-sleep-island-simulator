// @vitest-environment jsdom

import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IndividualsPage } from "../../features/individuals/IndividualsPage";
import { SettingsPage } from "../../features/settings/SettingsPage";

async function seriousViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
}

describe("major page accessibility", () => {
  it("has no serious automatic violations on the individuals page", async () => {
    const { container } = render(<IndividualsPage />);
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("has no serious automatic violations on the settings page", async () => {
    const { container } = render(<SettingsPage />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
