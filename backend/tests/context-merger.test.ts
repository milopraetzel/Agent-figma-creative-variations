import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot, writeMemoryFile } from "../src/memory";
import { mergeContext } from "../src/context-merger";
import { saveBrandPreset } from "../src/brands";
import type { BrandPreset } from "../../plugin/src/types";

const TEST_DIR = path.join(__dirname, "__test_context__");

describe("context merger", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands", "acme"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "templates"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "projects"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("returns empty string when no files exist", () => {
    const ctx = mergeContext({});
    expect(ctx).toBe("");
  });

  it("returns brand context only", () => {
    writeMemoryFile("brands", "acme", "brand.md", "# Brand\nBe bold and confident.");
    const ctx = mergeContext({ brandName: "acme" });
    expect(ctx).toContain("## Brand Context");
    expect(ctx).toContain("Be bold and confident.");
  });

  it("returns template context only", () => {
    writeMemoryFile("templates", "", "instagram-story.md", "# Story\nKeep text in middle 60%.");
    const ctx = mergeContext({ templateId: "instagram-story" });
    expect(ctx).toContain("## Template Context");
    expect(ctx).toContain("Keep text in middle 60%.");
  });

  it("returns project context only", () => {
    writeMemoryFile("projects", "", "q1-launch.md", "# Q1\nUrgent messaging OK.");
    const ctx = mergeContext({ projectName: "q1-launch" });
    expect(ctx).toContain("## Project Context");
    expect(ctx).toContain("Urgent messaging OK.");
  });

  it("merges all three layers with priority headers", () => {
    writeMemoryFile("brands", "acme", "brand.md", "Never use exclamation marks.");
    writeMemoryFile("templates", "", "instagram-story.md", "Keep text in middle 60%.");
    writeMemoryFile("projects", "", "q1-launch.md", "Urgency OK — override brand voice.");

    const ctx = mergeContext({ brandName: "acme", templateId: "instagram-story", projectName: "q1-launch" });

    expect(ctx).toContain("## Brand Context");
    expect(ctx).toContain("## Template Context");
    expect(ctx).toContain("## Project Context (highest priority — overrides brand and template)");

    const brandIdx = ctx.indexOf("## Brand Context");
    const templateIdx = ctx.indexOf("## Template Context");
    const projectIdx = ctx.indexOf("## Project Context");
    expect(brandIdx).toBeLessThan(templateIdx);
    expect(templateIdx).toBeLessThan(projectIdx);
  });

  it("reads all .md files from a brand directory", () => {
    writeMemoryFile("brands", "acme", "brand.md", "Voice: confident.");
    writeMemoryFile("brands", "acme", "visual.md", "Colors: purple primary.");
    const ctx = mergeContext({ brandName: "acme" });
    expect(ctx).toContain("Voice: confident.");
    expect(ctx).toContain("Colors: purple primary.");
  });

  it("skips missing layers gracefully", () => {
    writeMemoryFile("brands", "acme", "brand.md", "Brand content.");
    const ctx = mergeContext({ brandName: "acme", templateId: "nonexistent", projectName: "nonexistent" });
    expect(ctx).toContain("Brand content.");
    expect(ctx).not.toContain("## Template Context");
    expect(ctx).not.toContain("## Project Context");
  });
});

describe("context merger with brand preset", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands", "acme"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "templates"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "projects"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });
  afterEach(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });

  it("includes brand preset in context when available", () => {
    const preset: BrandPreset = {
      name: "Acme", colors: { primary: "#6B4EFF" },
      fonts: { headline: { family: "Inter", weight: 700 }, body: { family: "Inter", weight: 400 } },
    };
    saveBrandPreset("acme", preset);
    writeMemoryFile("brands", "acme", "brand.md", "Voice: confident.");
    const ctx = mergeContext({ brandName: "acme" });
    expect(ctx).toContain("Voice: confident.");
    expect(ctx).toContain("Brand Preset: Acme");
    expect(ctx).toContain("#6B4EFF");
  });
});
