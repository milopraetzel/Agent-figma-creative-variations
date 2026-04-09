import * as fs from "node:fs";
import * as path from "node:path";
import { getMemoryRoot, listMemoryFiles } from "./memory";
import type { BrandPreset } from "../../plugin/src/types";

function presetPath(brandName: string): string {
  return path.join(getMemoryRoot(), "brands", brandName, "preset.json");
}

export function saveBrandPreset(brandName: string, preset: BrandPreset): void {
  const filePath = presetPath(brandName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(preset, null, 2), "utf-8");
}

export function loadBrandPreset(brandName: string): BrandPreset | null {
  try {
    const raw = fs.readFileSync(presetPath(brandName), "utf-8");
    return JSON.parse(raw) as BrandPreset;
  } catch { return null; }
}

export function listBrands(): string[] {
  return listMemoryFiles("brands", "").filter((dir) => {
    try { return fs.existsSync(presetPath(dir)); } catch { return false; }
  });
}

export function brandPresetToContext(preset: BrandPreset): string {
  const lines: string[] = [`### Brand Preset: ${preset.name}`];
  lines.push(`\nColors:`);
  lines.push(`- Primary: ${preset.colors.primary}`);
  if (preset.colors.secondary) lines.push(`- Secondary: ${preset.colors.secondary}`);
  if (preset.colors.accent) lines.push(`- Accent: ${preset.colors.accent}`);
  if (preset.colors.background) lines.push(`- Background: ${preset.colors.background}`);
  lines.push(`\nFonts:`);
  lines.push(`- Headlines: ${preset.fonts.headline.family} ${preset.fonts.headline.weight}${preset.fonts.headline.transform ? `, ${preset.fonts.headline.transform}` : ""}`);
  lines.push(`- Body: ${preset.fonts.body.family} ${preset.fonts.body.weight}`);
  if (preset.logo) {
    lines.push(`\nLogo placement:`);
    lines.push(`- Position: ${preset.logo.position}`);
    lines.push(`- Clearance: ${preset.logo.clearance}% of shortest edge`);
    lines.push(`- Min size: ${preset.logo.minSize}px`);
  }
  if (preset.constraints) {
    lines.push(`\nConstraints:`);
    if (preset.constraints.minFontSize) lines.push(`- Min font size (digital): ${preset.constraints.minFontSize}px`);
    if (preset.constraints.minFontSizePrint) lines.push(`- Min font size (print): ${preset.constraints.minFontSizePrint}pt`);
    if (preset.constraints.maxHeadlineWords) lines.push(`- Max headline length: ${preset.constraints.maxHeadlineWords} words`);
  }
  return lines.join("\n");
}
