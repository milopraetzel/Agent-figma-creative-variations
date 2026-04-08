import { describe, it, expect } from "vitest";
import { REFLOW_SYSTEM_PROMPT, buildPrintContext } from "../src/prompt";

describe("prompt", () => {
  it("system prompt contains core principles", () => {
    expect(REFLOW_SYSTEM_PROMPT).toContain("RELATIONSHIPS OVER COORDINATES");
    expect(REFLOW_SYSTEM_PROMPT).toContain("MINIMUM READABILITY");
  });

  it("buildPrintContext returns empty string for no metadata", () => {
    expect(buildPrintContext(undefined)).toBe("");
  });

  it("buildPrintContext includes bleed and safe zone for print", () => {
    const ctx = buildPrintContext({
      unit: "mm", originalWidth: 210, originalHeight: 297, dpi: 300, bleed: 3, safeZone: 5,
    });
    expect(ctx).toContain("210×297mm");
    expect(ctx).toContain("300 DPI");
    expect(ctx).toContain("3mm bleed");
    expect(ctx).toContain("5mm safe zone");
    expect(ctx).toContain("font sizes in pt");
  });

  it("buildPrintContext handles inches", () => {
    const ctx = buildPrintContext({
      unit: "in", originalWidth: 8.5, originalHeight: 11, dpi: 300, bleed: 0.125, safeZone: 0.25,
    });
    expect(ctx).toContain("8.5×11in");
    expect(ctx).toContain("0.125in bleed");
  });
});
