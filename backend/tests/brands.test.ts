import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot } from "../src/memory";
import { saveBrandPreset, loadBrandPreset, listBrands, brandPresetToContext } from "../src/brands";
import type { BrandPreset } from "../../plugin/src/types";

const TEST_DIR = path.join(__dirname, "__test_brands__");

const samplePreset: BrandPreset = {
  name: "Acme Corp",
  colors: { primary: "#6B4EFF", secondary: "#1E1E1E", accent: "#F59E0B" },
  fonts: {
    headline: { family: "Inter", weight: 700, transform: "uppercase" },
    body: { family: "Inter", weight: 400 },
  },
  logo: { position: "bottom-right", clearance: 8, minSize: 40 },
  constraints: { minFontSize: 14, minFontSizePrint: 9, maxHeadlineWords: 6 },
};

describe("brands", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands", "acme"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });
  afterEach(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });

  it("saves and loads a brand preset", () => {
    saveBrandPreset("acme", samplePreset);
    const loaded = loadBrandPreset("acme");
    expect(loaded).toEqual(samplePreset);
  });

  it("returns null for non-existent brand", () => {
    expect(loadBrandPreset("nope")).toBeNull();
  });

  it("lists brands that have presets", () => {
    saveBrandPreset("acme", samplePreset);
    saveBrandPreset("nike", { ...samplePreset, name: "Nike" });
    const brands = listBrands();
    expect(brands).toContain("acme");
    expect(brands).toContain("nike");
  });

  it("converts preset to context string", () => {
    const ctx = brandPresetToContext(samplePreset);
    expect(ctx).toContain("Brand Preset: Acme Corp");
    expect(ctx).toContain("#6B4EFF");
    expect(ctx).toContain("Inter");
    expect(ctx).toContain("bottom-right");
    expect(ctx).toContain("8%");
    expect(ctx).toContain("14px");
    expect(ctx).toContain("9pt");
    expect(ctx).toContain("6 words");
  });

  it("handles preset without optional fields", () => {
    const minimal: BrandPreset = {
      name: "Minimal", colors: { primary: "#000" },
      fonts: { headline: { family: "Arial", weight: 700 }, body: { family: "Arial", weight: 400 } },
    };
    const ctx = brandPresetToContext(minimal);
    expect(ctx).toContain("Brand Preset: Minimal");
    expect(ctx).toContain("#000");
    expect(ctx).not.toContain("Logo");
    expect(ctx).not.toContain("Constraints");
  });
});
