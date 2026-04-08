# Plan 2: Template System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 6-format list with a full template registry covering Digital (Social, Display, Video, Email) and Print (DIN, US, Posters, Business, Packaging) formats, with category/subcategory browsing, multi-select, template sets, orientation toggle, and print-specific features (bleed, safe zones, DPI).

**Architecture:** Template data lives in a shared `templates.ts` module imported by both plugin UI and backend. The UI gets a two-level category browser (Digital/Print → subcategory). Users can select multiple formats per generation. The backend loops over selected formats, calling reflow once per unique aspect ratio. Print formats carry metadata (bleed, DPI, unit) that gets passed to the reflow prompt.

**Tech Stack:** TypeScript, Preact (plugin UI), existing Express backend

---

## File Structure

```
Agent-figma-creative-variations/
├── shared/
│   └── templates.ts                     # Template registry — all format definitions
│   └── templates.test.ts                # Tests for template helpers
│
├── plugin/
│   ├── src/
│   │   ├── ui.tsx                       # MODIFY: replace FORMATS with template browser
│   │   ├── code.ts                      # MODIFY: handle multi-format generation
│   │   └── types.ts                     # MODIFY: add template types, update UIMessage
│
├── backend/
│   ├── src/
│   │   ├── server.ts                    # MODIFY: accept multiple formats, add /api/templates
│   │   ├── prompt.ts                    # MODIFY: add print-aware context to system prompt
│   │   └── reflow.ts                    # MODIFY: accept print metadata
```

---

### Task 1: Template Data Model & Registry

**Files:**
- Modify: `plugin/src/types.ts`
- Create: `shared/templates.ts`
- Create: `shared/templates.test.ts`

- [ ] **Step 1: Add template types to plugin/src/types.ts**

Add these types after the existing `ReflowResponse` interface:

```typescript
// ---- Template System ----

export interface FormatTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  category: "Digital" | "Print";
  subcategory: string;
  unit: "px" | "mm" | "in";
  dpi: number;
  bleed?: number;       // in same unit — e.g., 3 for 3mm
  safeZone?: number;    // inset from edge after bleed
  notes?: string;       // platform-specific notes
}

export interface TemplateSet {
  id: string;
  name: string;
  formatIds: string[];
}
```

- [ ] **Step 2: Run existing tests to make sure nothing broke**

```bash
npx vitest run
```

Expected: all 15 tests PASS (types are additive).

- [ ] **Step 3: Write failing tests for template helpers**

Create `shared/templates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ALL_TEMPLATES,
  getTemplatesByCategory,
  getTemplatesBySubcategory,
  getTemplateById,
  getCategories,
  getSubcategories,
  toPx,
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
    // A4: 210×297mm at 300dpi → 2480×3508px
    expect(toPx(210, "mm", 300)).toBeCloseTo(2480, -1);
    expect(toPx(297, "mm", 300)).toBeCloseTo(3508, -1);
  });

  it("converts inches to px at given dpi", () => {
    // US Letter: 8.5×11in at 300dpi → 2550×3300px
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
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx vitest run shared/templates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement the template registry**

Create `shared/templates.ts`:

```typescript
import type { FormatTemplate } from "../plugin/src/types";

export function toPx(value: number, unit: "px" | "mm" | "in", dpi: number): number {
  switch (unit) {
    case "px": return value;
    case "mm": return Math.round((value / 25.4) * dpi);
    case "in": return Math.round(value * dpi);
  }
}

function digital(
  id: string, name: string, width: number, height: number, subcategory: string, notes?: string,
): FormatTemplate {
  return { id, name, width, height, category: "Digital", subcategory, unit: "px", dpi: 72, notes };
}

function print(
  id: string, name: string, width: number, height: number,
  unit: "mm" | "in", subcategory: string, bleed?: number, notes?: string,
): FormatTemplate {
  return {
    id, name, width, height, category: "Print", subcategory,
    unit, dpi: 300, bleed: bleed ?? (unit === "mm" ? 3 : 0.125), safeZone: bleed ?? (unit === "mm" ? 5 : 0.25),
    notes,
  };
}

export const ALL_TEMPLATES: FormatTemplate[] = [
  // ---- Digital: Social Media ----
  digital("instagram-post", "Instagram Post", 1080, 1080, "Social Media"),
  digital("instagram-story", "Instagram Story", 1080, 1920, "Social Media"),
  digital("instagram-reel-cover", "Instagram Reel Cover", 1080, 1920, "Social Media"),
  digital("facebook-post", "Facebook Post", 1200, 630, "Social Media"),
  digital("facebook-ad", "Facebook Ad", 1200, 628, "Social Media"),
  digital("linkedin-post", "LinkedIn Post", 1200, 627, "Social Media"),
  digital("linkedin-banner", "LinkedIn Banner", 1584, 396, "Social Media"),
  digital("x-post", "X/Twitter Post", 1600, 900, "Social Media"),
  digital("tiktok-cover", "TikTok Cover", 1080, 1920, "Social Media"),
  digital("pinterest-pin", "Pinterest Pin", 1000, 1500, "Social Media"),
  digital("youtube-thumbnail", "YouTube Thumbnail", 1280, 720, "Social Media"),

  // ---- Digital: Display Ads ----
  digital("leaderboard", "Leaderboard", 728, 90, "Display Ads"),
  digital("medium-rectangle", "Medium Rectangle", 300, 250, "Display Ads"),
  digital("wide-skyscraper", "Wide Skyscraper", 160, 600, "Display Ads"),
  digital("half-page", "Half Page", 300, 600, "Display Ads"),
  digital("large-rectangle", "Large Rectangle", 336, 280, "Display Ads"),
  digital("billboard", "Billboard", 970, 250, "Display Ads"),

  // ---- Digital: Video ----
  digital("video-landscape", "16:9 Landscape", 1920, 1080, "Video"),
  digital("video-portrait", "9:16 Portrait", 1080, 1920, "Video"),
  digital("video-square", "1:1 Square", 1080, 1080, "Video"),
  digital("video-vertical", "4:5 Vertical", 1080, 1350, "Video"),

  // ---- Digital: Email & Web ----
  digital("email-header", "Email Header", 600, 200, "Email & Web"),
  digital("web-banner", "Web Banner", 1440, 400, "Email & Web"),
  digital("og-image", "OG Image", 1200, 630, "Email & Web"),

  // ---- Print: DIN Standard ----
  print("din-a3", "A3 Poster", 297, 420, "mm", "DIN Standard"),
  print("din-a4", "A4 Flyer", 210, 297, "mm", "DIN Standard"),
  print("din-a5", "A5 Flyer", 148, 210, "mm", "DIN Standard"),
  print("din-a6", "A6 Postcard", 105, 148, "mm", "DIN Standard"),
  print("din-dl", "DL Envelope", 99, 210, "mm", "DIN Standard"),

  // ---- Print: US Standard ----
  print("us-letter", "US Letter", 8.5, 11, "in", "US Standard"),
  print("us-legal", "US Legal", 8.5, 14, "in", "US Standard"),
  print("us-tabloid", "US Tabloid", 11, 17, "in", "US Standard"),
  print("us-postcard", "US Postcard", 4, 6, "in", "US Standard"),

  // ---- Print: Posters & Signage ----
  print("poster-18x24", "18×24in Poster", 18, 24, "in", "Posters & Signage"),
  print("poster-24x36", "24×36in Poster", 24, 36, "in", "Posters & Signage"),
  print("din-a1", "A1 Poster", 594, 841, "mm", "Posters & Signage"),
  print("din-a0", "A0 Poster", 841, 1189, "mm", "Posters & Signage"),
  print("rollup-banner", "Roll-Up Banner", 850, 2000, "mm", "Posters & Signage"),

  // ---- Print: Business ----
  print("business-card-eu", "Business Card", 85, 55, "mm", "Business"),
  print("business-card-us", "US Business Card", 3.5, 2, "in", "Business"),
  print("letterhead", "Letterhead", 210, 297, "mm", "Business", 0, "No bleed — matches A4"),
  print("compliment-slip", "Compliment Slip", 99, 210, "mm", "Business"),
];

export function getCategories(): string[] {
  return [...new Set(ALL_TEMPLATES.map((t) => t.category))];
}

export function getSubcategories(category: string): string[] {
  return [...new Set(ALL_TEMPLATES.filter((t) => t.category === category).map((t) => t.subcategory))];
}

export function getTemplatesByCategory(category: string): FormatTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesBySubcategory(category: string, subcategory: string): FormatTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category && t.subcategory === subcategory);
}

export function getTemplateById(id: string): FormatTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run shared/templates.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add plugin/src/types.ts shared/templates.ts shared/templates.test.ts
git commit -m "feat: add template registry with 43 digital and print formats"
```

---

### Task 2: Multi-Format UIMessage & Backend Support

**Files:**
- Modify: `plugin/src/types.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/server.test.ts`

- [ ] **Step 1: Update UIMessage to support multiple formats**

In `plugin/src/types.ts`, replace the existing `UIMessage` type:

```typescript
export type UIMessage =
  | { type: "GENERATE"; formats: Array<{ id: string; name: string; widthPx: number; heightPx: number; printMeta?: PrintMeta }>; copyVariations: Record<string, string[]> }
  | { type: "CANCEL" };

export interface PrintMeta {
  unit: "mm" | "in";
  originalWidth: number;
  originalHeight: number;
  dpi: number;
  bleed?: number;
  safeZone?: number;
}
```

- [ ] **Step 2: Update ReflowRequest to include print metadata**

In `plugin/src/types.ts`, update `ReflowRequest`:

```typescript
export interface ReflowRequest {
  frame: FrameDescriptor;
  targetWidth: number;
  targetHeight: number;
  copyVariations: Record<string, string[]>;
  printMeta?: PrintMeta;
}
```

- [ ] **Step 3: Write failing test for multi-format server endpoint**

Add to `backend/tests/server.test.ts` — append this new describe block:

```typescript
describe("POST /api/reflow with printMeta", () => {
  beforeEach(() => { mockGenerateReflow.mockReset(); });

  it("passes printMeta to generateReflow", async () => {
    mockGenerateReflow.mockResolvedValue({
      targetWidth: 2480, targetHeight: 3508,
      elements: [{ id: "text-1", x: 100, y: 200, width: 2280, height: 200, rotation: 0, visible: true, fontSize: 72 }],
    });

    const request = {
      frame: sampleRequest.frame,
      targetWidth: 2480,
      targetHeight: 3508,
      copyVariations: {},
      printMeta: { unit: "mm", originalWidth: 210, originalHeight: 297, dpi: 300, bleed: 3, safeZone: 5 },
    };

    const app = createApp();
    const res = await postJSON(app, "/api/reflow", request);

    expect(res.status).toBe(200);
    expect(mockGenerateReflow).toHaveBeenCalledWith(
      expect.anything(), 2480, 3508, undefined, request.printMeta,
    );
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx vitest run backend/tests/server.test.ts
```

Expected: FAIL — `generateReflow` called with wrong args.

- [ ] **Step 5: Update server.ts to pass printMeta**

In `backend/src/server.ts`, update the reflow call in the POST handler. Change:

```typescript
const reflow = await generateReflow(frame, targetWidth, targetHeight);
```

to (in both places it appears):

```typescript
const reflow = await generateReflow(frame, targetWidth, targetHeight, undefined, body.printMeta);
```

- [ ] **Step 6: Update reflow.ts to accept printMeta**

In `backend/src/reflow.ts`, update the function signature:

```typescript
export async function generateReflow(
  frame: FrameDescriptor,
  targetWidth: number,
  targetHeight: number,
  markdownContext?: string,
  printMeta?: { unit: string; originalWidth: number; originalHeight: number; dpi: number; bleed?: number; safeZone?: number },
): Promise<ReflowInstructions> {
```

And add print context to the user message. Replace the messages array:

```typescript
    messages: [
      {
        role: "user",
        content: printMeta
          ? `Reflow this frame from ${frame.width}×${frame.height} to ${targetWidth}×${targetHeight} (print: ${printMeta.originalWidth}×${printMeta.originalHeight}${printMeta.unit}, ${printMeta.dpi}dpi, bleed: ${printMeta.bleed ?? 0}${printMeta.unit}, safe zone: ${printMeta.safeZone ?? 0}${printMeta.unit}).\n\nFrame descriptor:\n${JSON.stringify(frame, null, 2)}`
          : `Reflow this frame from ${frame.width}×${frame.height} to ${targetWidth}×${targetHeight}.\n\nFrame descriptor:\n${JSON.stringify(frame, null, 2)}`,
      },
    ],
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS (existing reflow tests don't pass printMeta, so the optional param doesn't break them).

- [ ] **Step 8: Commit**

```bash
git add plugin/src/types.ts backend/src/server.ts backend/src/reflow.ts backend/tests/server.test.ts
git commit -m "feat: add multi-format and print metadata support to API"
```

---

### Task 3: Print-Aware Reflow Prompt

**Files:**
- Modify: `backend/src/prompt.ts`
- Create: `backend/tests/prompt.test.ts`

- [ ] **Step 1: Write failing test for print prompt enhancement**

Create `backend/tests/prompt.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run backend/tests/prompt.test.ts
```

Expected: FAIL — `buildPrintContext` not found.

- [ ] **Step 3: Add buildPrintContext to prompt.ts**

Add this function to `backend/src/prompt.ts`:

```typescript
export function buildPrintContext(printMeta?: {
  unit: string; originalWidth: number; originalHeight: number;
  dpi: number; bleed?: number; safeZone?: number;
}): string {
  if (!printMeta) return "";

  const { unit, originalWidth, originalHeight, dpi, bleed, safeZone } = printMeta;
  const lines = [
    `\n## Print Format Context`,
    `Target: ${originalWidth}×${originalHeight}${unit} at ${dpi} DPI.`,
  ];
  if (bleed) lines.push(`Bleed: ${bleed}${unit} — extend backgrounds and images beyond the trim line.`);
  if (safeZone) lines.push(`Safe zone: ${safeZone}${unit} — keep all text and critical elements inside this margin from the trim edge.`);
  lines.push(`Use font sizes in pt (not px). Minimum readable: 8pt.`);
  lines.push(`Ensure high contrast for print reproduction.`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run backend/tests/prompt.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Wire buildPrintContext into reflow.ts**

In `backend/src/reflow.ts`, import and use:

```typescript
import { REFLOW_SYSTEM_PROMPT, REFLOW_TOOL, buildPrintContext } from "./prompt";
```

Update the system prompt construction:

```typescript
  let systemPrompt = REFLOW_SYSTEM_PROMPT;
  if (markdownContext) systemPrompt += `\n\n## Additional Context\n\n${markdownContext}`;
  if (printMeta) systemPrompt += buildPrintContext(printMeta);
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/prompt.ts backend/src/reflow.ts backend/tests/prompt.test.ts
git commit -m "feat: add print-aware context to reflow prompt"
```

---

### Task 4: Template Browser UI

**Files:**
- Modify: `plugin/src/ui.tsx`

- [ ] **Step 1: Rewrite ui.tsx with template browser**

Replace the entire content of `plugin/src/ui.tsx`:

```tsx
import { render } from "preact";
import { useState, useEffect, useMemo } from "preact/hooks";
import type { PluginMessage, UIMessage, FormatTemplate, PrintMeta } from "./types";
import {
  ALL_TEMPLATES,
  getCategories,
  getSubcategories,
  getTemplatesBySubcategory,
  toPx,
} from "../../shared/templates";

interface FrameInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  textLayerCount: number;
}

function App() {
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Digital");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("Social Media");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyText, setCopyText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const categories = useMemo(() => getCategories(), []);
  const subcategories = useMemo(() => getSubcategories(selectedCategory), [selectedCategory]);
  const templates = useMemo(
    () => getTemplatesBySubcategory(selectedCategory, selectedSubcategory),
    [selectedCategory, selectedSubcategory],
  );

  useEffect(() => {
    if (subcategories.length > 0 && !subcategories.includes(selectedSubcategory)) {
      setSelectedSubcategory(subcategories[0]);
    }
  }, [subcategories, selectedSubcategory]);

  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginMessage;
      if (!msg) return;
      switch (msg.type) {
        case "SELECTION_CHANGED": setFrame(msg.frame); break;
        case "GENERATION_PROGRESS": setStatus(`${msg.format}: ${msg.step}`); break;
        case "GENERATION_COMPLETE": setStatus("Done!"); setGenerating(false); break;
        case "ERROR": setStatus(`Error: ${msg.message}`); setGenerating(false); break;
      }
    };
  }, []);

  function toggleFormat(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleGenerate() {
    if (!frame || selectedIds.size === 0) return;
    setGenerating(true);
    setStatus("Starting...");

    const lines = copyText.split("\n").filter((l) => l.trim());
    const copyVariations: Record<string, string[]> = {};
    if (lines.length > 0) copyVariations["__all__"] = lines;

    const formats = ALL_TEMPLATES
      .filter((t) => selectedIds.has(t.id))
      .map((t) => {
        const widthPx = toPx(t.width, t.unit, t.dpi);
        const heightPx = toPx(t.height, t.unit, t.dpi);
        const printMeta: PrintMeta | undefined = t.category === "Print"
          ? { unit: t.unit as "mm" | "in", originalWidth: t.width, originalHeight: t.height, dpi: t.dpi, bleed: t.bleed, safeZone: t.safeZone }
          : undefined;
        return { id: t.id, name: t.name, widthPx, heightPx, printMeta };
      });

    const msg: UIMessage = { type: "GENERATE", formats, copyVariations };
    parent.postMessage({ pluginMessage: msg }, "*");
  }

  function formatDimensions(t: FormatTemplate): string {
    if (t.unit === "px") return `${t.width}×${t.height}`;
    return `${t.width}×${t.height}${t.unit}`;
  }

  const selectedCount = selectedIds.size;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Creative Variations</span>
        {selectedCount > 0 && (
          <span style={styles.badge}>{selectedCount} format{selectedCount > 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Source frame */}
      <div style={styles.section}>
        <div style={styles.label}>SOURCE FRAME</div>
        {frame ? (
          <div style={styles.frameInfo}>
            <div style={styles.frameName}>▣ "{frame.name}"</div>
            <div style={styles.frameMeta}>
              {frame.width} × {frame.height} · {frame.textLayerCount} text layers
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>Select a frame in Figma</div>
        )}
      </div>

      {/* Category tabs */}
      <div style={styles.section}>
        <div style={styles.label}>TARGET FORMATS</div>
        <div style={styles.categoryTabs}>
          {categories.map((cat) => (
            <div
              key={cat}
              style={{ ...styles.categoryTab, ...(selectedCategory === cat ? styles.categoryTabActive : {}) }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </div>
          ))}
        </div>

        {/* Subcategory pills */}
        <div style={styles.subcategoryRow}>
          {subcategories.map((sub) => (
            <div
              key={sub}
              style={{ ...styles.subcategoryPill, ...(selectedSubcategory === sub ? styles.subcategoryPillActive : {}) }}
              onClick={() => setSelectedSubcategory(sub)}
            >
              {sub}
            </div>
          ))}
        </div>

        {/* Format list */}
        <div style={styles.formatList}>
          {templates.map((t) => {
            const isSelected = selectedIds.has(t.id);
            return (
              <div
                key={t.id}
                style={{ ...styles.formatItem, ...(isSelected ? styles.formatItemSelected : {}) }}
                onClick={() => toggleFormat(t.id)}
              >
                <div style={styles.formatCheckbox}>
                  {isSelected ? (
                    <div style={styles.checkboxChecked}>✓</div>
                  ) : (
                    <div style={styles.checkboxUnchecked} />
                  )}
                </div>
                <div style={styles.formatInfo}>
                  <span>{t.name}</span>
                  {t.bleed != null && t.bleed > 0 && (
                    <span style={styles.bleedBadge}>+bleed</span>
                  )}
                </div>
                <span style={styles.formatSize}>{formatDimensions(t)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Copy variations */}
      <div style={styles.section}>
        <div style={styles.label}>COPY VARIATIONS (one per line)</div>
        <textarea
          style={styles.textarea}
          value={copyText}
          onInput={(e) => setCopyText((e.target as HTMLTextAreaElement).value)}
          placeholder={"Think Different. Build Better.\nYour Vision, Our Platform.\nDesign Without Limits."}
          rows={4}
        />
      </div>

      {/* Generate button */}
      <button
        style={{ ...styles.generateButton, ...((!frame || selectedIds.size === 0 || generating) ? styles.generateButtonDisabled : {}) }}
        onClick={handleGenerate}
        disabled={!frame || selectedIds.size === 0 || generating}
      >
        {generating
          ? "Generating..."
          : `Generate ${selectedCount} format${selectedCount !== 1 ? "s" : ""}`}
      </button>

      {status && <div style={styles.status}>{status}</div>}
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "13px", color: "#e0e0e0", background: "#1e1e1e",
    minHeight: "100vh", display: "flex", flexDirection: "column",
  },
  header: {
    padding: "12px 16px", borderBottom: "1px solid #333",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  title: { fontWeight: "600", fontSize: "14px" },
  badge: {
    background: "#a78bfa", color: "#1e1e1e", padding: "2px 8px",
    borderRadius: "10px", fontSize: "11px", fontWeight: "600",
  },
  section: { padding: "12px 16px" },
  label: {
    fontSize: "11px", color: "#888", textTransform: "uppercase",
    marginBottom: "8px", letterSpacing: "0.5px",
  },
  frameInfo: {
    background: "#2a2a2a", border: "1px dashed #555",
    borderRadius: "6px", padding: "12px", textAlign: "center",
  },
  frameName: { color: "#a78bfa" },
  frameMeta: { fontSize: "11px", color: "#666", marginTop: "4px" },
  emptyState: {
    background: "#2a2a2a", border: "1px dashed #444",
    borderRadius: "6px", padding: "24px", textAlign: "center", color: "#666",
  },
  categoryTabs: { display: "flex", gap: "0", marginBottom: "10px" },
  categoryTab: {
    padding: "6px 14px", background: "#333", fontSize: "12px",
    cursor: "pointer", borderRadius: "0",
  },
  categoryTabActive: {
    background: "#a78bfa", color: "#1e1e1e", fontWeight: "600",
  },
  subcategoryRow: {
    display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap",
  },
  subcategoryPill: {
    padding: "3px 8px", background: "#2a2a2a", border: "1px solid #444",
    borderRadius: "12px", fontSize: "11px", cursor: "pointer",
  },
  subcategoryPillActive: {
    background: "rgba(167,139,250,0.2)", border: "1px solid #a78bfa", color: "#a78bfa",
  },
  formatList: { display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" },
  formatItem: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "6px 8px", borderRadius: "4px", cursor: "pointer",
  },
  formatItemSelected: { background: "rgba(167,139,250,0.12)" },
  formatCheckbox: { width: "16px", height: "16px", flexShrink: 0 },
  checkboxChecked: {
    width: "16px", height: "16px", border: "2px solid #a78bfa",
    borderRadius: "3px", background: "#a78bfa", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#1e1e1e",
  },
  checkboxUnchecked: {
    width: "16px", height: "16px", border: "2px solid #444", borderRadius: "3px",
  },
  formatInfo: { flex: 1, display: "flex", alignItems: "center", gap: "6px" },
  bleedBadge: {
    fontSize: "9px", color: "#f59e0b", background: "rgba(245,158,11,0.15)",
    padding: "1px 4px", borderRadius: "3px",
  },
  formatSize: { fontSize: "11px", color: "#666" },
  textarea: {
    width: "100%", background: "#2a2a2a", border: "1px solid #444",
    borderRadius: "4px", padding: "8px", color: "#e0e0e0",
    fontSize: "12px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
  },
  generateButton: {
    margin: "12px 16px", padding: "10px", background: "#a78bfa",
    color: "#1e1e1e", border: "none", borderRadius: "6px",
    fontWeight: "600", fontSize: "14px", cursor: "pointer", textAlign: "center",
  },
  generateButtonDisabled: { opacity: 0.5, cursor: "not-allowed" },
  status: { padding: "8px 16px", fontSize: "12px", color: "#888", textAlign: "center" },
};

render(<App />, document.getElementById("root")!);
```

- [ ] **Step 2: Verify build**

```bash
npm run build:plugin
```

Expected: dist/code.js and ui.html created.

- [ ] **Step 3: Commit**

```bash
git add plugin/src/ui.tsx
git commit -m "feat: replace hardcoded formats with full template browser UI"
```

---

### Task 5: Multi-Format Plugin Sandbox

**Files:**
- Modify: `plugin/src/code.ts`

- [ ] **Step 1: Update code.ts to handle multi-format generation**

Replace the `figma.ui.on("message", ...)` handler in `plugin/src/code.ts`:

```typescript
import { serializeFrame } from "./serializer";
import { applyReflow } from "./applier";
import type { PluginMessage, UIMessage, ReflowRequest, ReflowResponse } from "./types";

const BACKEND_URL = "http://localhost:3001";

figma.showUI(__html__, { width: 400, height: 600 });

figma.on("selectionchange", () => {
  const sel = figma.currentPage.selection[0];
  if (sel && sel.type === "FRAME") {
    const textLayers = (sel as FrameNode).findAll((n) => n.type === "TEXT");
    const msg: PluginMessage = {
      type: "SELECTION_CHANGED",
      frame: {
        id: sel.id,
        name: sel.name,
        width: sel.width,
        height: sel.height,
        textLayerCount: textLayers.length,
      },
    };
    figma.ui.postMessage(msg);
  } else {
    figma.ui.postMessage({ type: "SELECTION_CHANGED", frame: null } as PluginMessage);
  }
});

figma.ui.on("message", async (msg: UIMessage) => {
  if (msg.type === "GENERATE") {
    try {
      const sel = figma.currentPage.selection[0];
      if (!sel || sel.type !== "FRAME") {
        figma.ui.postMessage({ type: "ERROR", message: "No frame selected" } as PluginMessage);
        return;
      }

      const frame = serializeFrame(sel);
      const totalFormats = msg.formats.length;

      for (let i = 0; i < msg.formats.length; i++) {
        const fmt = msg.formats[i];

        figma.ui.postMessage({
          type: "GENERATION_PROGRESS",
          format: fmt.name,
          step: `Reflowing (${i + 1}/${totalFormats})...`,
        } as PluginMessage);

        const request: ReflowRequest = {
          frame,
          targetWidth: fmt.widthPx,
          targetHeight: fmt.heightPx,
          copyVariations: msg.copyVariations,
          printMeta: fmt.printMeta,
        };

        const response = await fetch(`${BACKEND_URL}/api/reflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error ?? `Backend returned ${response.status}`);
        }

        const data: ReflowResponse = await response.json();
        await applyReflow(sel.id, fmt.name, data.variations);
      }

      figma.ui.postMessage({ type: "GENERATION_COMPLETE", pageId: "done" } as PluginMessage);
      figma.notify(`✓ Generated variations for ${totalFormats} format${totalFormats > 1 ? "s" : ""}`);
    } catch (err: any) {
      figma.ui.postMessage({ type: "ERROR", message: err.message } as PluginMessage);
      figma.notify(`✗ Error: ${err.message}`, { error: true });
    }
  }
});
```

- [ ] **Step 2: Verify build**

```bash
npm run build:plugin
```

Expected: builds without errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add plugin/src/code.ts
git commit -m "feat: update plugin sandbox for multi-format generation"
```

---

### Task 6: Full Build & Integration Verification

**Files:**
- No new files

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS (template tests + existing 15).

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: dist/code.js, ui.html, backend/dist/server.js all created.

- [ ] **Step 3: Commit and push**

```bash
git push
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Template registry with 43 formats + helpers | 12 |
| 2 | Multi-format UIMessage + print metadata in API | 1 |
| 3 | Print-aware reflow prompt | 4 |
| 4 | Template browser UI (category/subcategory/multi-select) | build |
| 5 | Multi-format plugin sandbox | build |
| 6 | Full integration verification | full suite |
| **Total new** | | **17 tests** |

**After this plan:** The plugin will have a full template browser with 43 formats across Digital (Social, Display, Video, Email) and Print (DIN, US, Posters, Business) categories. Users can multi-select formats, and print formats carry bleed/DPI/safe zone metadata that gets passed to the Claude reflow prompt. Plans 3-4 will add markdown memory and team management.
