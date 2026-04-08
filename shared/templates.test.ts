import { describe, it, expect } from "vitest";
import {
  ALL_TEMPLATES, getTemplatesByCategory, getTemplatesBySubcategory,
  getTemplateById, getCategories, getSubcategories, toPx,
} from "./templates";

describe("template registry", () => {
  it("contains all expected categories", () => {
    const cats = getCategories();
    expect(cats).toContain("Digital");
    expect(cats).toContain("Print");
    expect(cats).toHaveLength(2);
  });

  it("has digital subcategories", () => {
    const subs = getSubcategories("Digital");
    expect(subs).toContain("Social Media");
    expect(subs).toContain("Display Ads");
    expect(subs).toContain("Video");
    expect(subs).toContain("Email & Web");
  });

  it("has print subcategories", () => {
    const subs = getSubcategories("Print");
    expect(subs).toContain("DIN Standard");
    expect(subs).toContain("US Standard");
    expect(subs).toContain("Posters & Signage");
    expect(subs).toContain("Business");
  });

  it("returns templates for a category", () => {
    const digital = getTemplatesByCategory("Digital");
    expect(digital.length).toBeGreaterThan(10);
    expect(digital.every((t) => t.category === "Digital")).toBe(true);
  });

  it("returns templates for a subcategory", () => {
    const social = getTemplatesBySubcategory("Digital", "Social Media");
    expect(social.length).toBeGreaterThan(5);
    const names = social.map((t) => t.name);
    expect(names).toContain("Instagram Post");
    expect(names).toContain("Instagram Story");
    expect(names).toContain("Facebook Post");
  });

  it("finds template by id", () => {
    const t = getTemplateById("instagram-post");
    expect(t).toBeDefined();
    expect(t!.name).toBe("Instagram Post");
    expect(t!.width).toBe(1080);
    expect(t!.height).toBe(1080);
  });

  it("digital templates use px and 72 dpi", () => {
    const digital = getTemplatesByCategory("Digital");
    expect(digital.every((t) => t.unit === "px")).toBe(true);
    expect(digital.every((t) => t.dpi === 72)).toBe(true);
  });

  it("print templates have bleed and higher dpi", () => {
    const print = getTemplatesByCategory("Print");
    expect(print.every((t) => t.dpi === 300)).toBe(true);
    const withBleed = print.filter((t) => t.bleed != null && t.bleed > 0);
    expect(withBleed.length).toBeGreaterThan(5);
  });

  it("converts mm to px at given dpi", () => {
    expect(toPx(210, "mm", 300)).toBeCloseTo(2480, -1);
    expect(toPx(297, "mm", 300)).toBeCloseTo(3508, -1);
  });

  it("converts inches to px at given dpi", () => {
    expect(toPx(8.5, "in", 300)).toBe(2550);
    expect(toPx(11, "in", 300)).toBe(3300);
  });

  it("px passthrough", () => {
    expect(toPx(1080, "px", 72)).toBe(1080);
  });

  it("total template count is reasonable", () => {
    expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(35);
    expect(ALL_TEMPLATES.length).toBeLessThan(80);
  });
});
