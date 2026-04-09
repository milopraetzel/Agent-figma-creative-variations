# Plan 4: Brand & Team Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add brand presets (fonts, colors, logo rules) that get passed as constraints to the reflow engine, template sets (saved groups of formats), and API key configuration — completing the agency-grade feature set.

**Architecture:** Brand presets stored as JSON files alongside the existing markdown memory files in `memory/brands/<name>/preset.json`. Template sets stored in `memory/template-sets/`. API key management via environment variable with optional per-request override. Brand preset data is serialized and appended to the markdown context before reflow. Template sets are a UI convenience — they map to a list of format IDs.

**Tech Stack:** TypeScript, Express (existing), JSON file storage, existing memory CRUD

---

## File Structure

```
Agent-figma-creative-variations/
├── backend/
│   ├── src/
│   │   ├── brands.ts                   # Brand preset CRUD + serialization to context
│   │   ├── template-sets.ts            # Template set CRUD
│   │   ├── server.ts                   # MODIFY: add brand + template-set endpoints
│   │   └── context-merger.ts           # MODIFY: include brand preset in merged context
│   └── tests/
│       ├── brands.test.ts
│       └── template-sets.test.ts
│
├── memory/
│   ├── brands/
│   │   └── example/
│   │       ├── brand.md                # (existing)
│   │       └── preset.json             # NEW: structured brand preset
│   └── template-sets/
│       └── example-social.json         # NEW: saved format group
│
├── plugin/
│   ├── src/
│   │   ├── types.ts                    # MODIFY: add BrandPreset, TemplateSetDef
│   │   └── ui.tsx                      # MODIFY: add template set save/load
```

---

### Task 1: Brand Preset Data Model & CRUD

**Files:**
- Modify: `plugin/src/types.ts`
- Create: `backend/src/brands.ts`
- Create: `backend/tests/brands.test.ts`

- [ ] **Step 1: Add BrandPreset type to plugin/src/types.ts**

Append after the existing `MemoryContext` interface:

```typescript
// ---- Brand Presets ----

export interface BrandPreset {
  name: string;
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
    background?: string;
  };
  fonts: {
    headline: { family: string; weight: number; transform?: string };
    body: { family: string; weight: number };
  };
  logo?: {
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
    clearance: number; // percentage of shortest edge
    minSize: number;   // px for digital, mm for print
  };
  constraints?: {
    minFontSize?: number;      // px
    minFontSizePrint?: number; // pt
    maxHeadlineWords?: number;
    safeZoneOverrides?: Record<string, string>; // format-id → custom safe zone note
  };
}

export interface TemplateSetDef {
  id: string;
  name: string;
  formatIds: string[];
}
```

- [ ] **Step 2: Write failing tests for brands module**

Create `backend/tests/brands.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot } from "../src/memory";
import {
  saveBrandPreset,
  loadBrandPreset,
  listBrands,
  brandPresetToContext,
} from "../src/brands";
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

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

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
      name: "Minimal",
      colors: { primary: "#000" },
      fonts: {
        headline: { family: "Arial", weight: 700 },
        body: { family: "Arial", weight: 400 },
      },
    };
    const ctx = brandPresetToContext(minimal);
    expect(ctx).toContain("Brand Preset: Minimal");
    expect(ctx).toContain("#000");
    expect(ctx).not.toContain("Logo");
    expect(ctx).not.toContain("Constraints");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run backend/tests/brands.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement brands.ts**

Create `backend/src/brands.ts`:

```typescript
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
  const filePath = presetPath(brandName);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as BrandPreset;
  } catch {
    return null;
  }
}

export function listBrands(): string[] {
  return listMemoryFiles("brands", "").filter((dir) => {
    try {
      return fs.existsSync(presetPath(dir));
    } catch {
      return false;
    }
  });
}

export function brandPresetToContext(preset: BrandPreset): string {
  const lines: string[] = [`### Brand Preset: ${preset.name}`];

  // Colors
  lines.push(`\nColors:`);
  lines.push(`- Primary: ${preset.colors.primary}`);
  if (preset.colors.secondary) lines.push(`- Secondary: ${preset.colors.secondary}`);
  if (preset.colors.accent) lines.push(`- Accent: ${preset.colors.accent}`);
  if (preset.colors.background) lines.push(`- Background: ${preset.colors.background}`);

  // Fonts
  lines.push(`\nFonts:`);
  lines.push(`- Headlines: ${preset.fonts.headline.family} ${preset.fonts.headline.weight}${preset.fonts.headline.transform ? `, ${preset.fonts.headline.transform}` : ""}`);
  lines.push(`- Body: ${preset.fonts.body.family} ${preset.fonts.body.weight}`);

  // Logo
  if (preset.logo) {
    lines.push(`\nLogo placement:`);
    lines.push(`- Position: ${preset.logo.position}`);
    lines.push(`- Clearance: ${preset.logo.clearance}% of shortest edge`);
    lines.push(`- Min size: ${preset.logo.minSize}px`);
  }

  // Constraints
  if (preset.constraints) {
    lines.push(`\nConstraints:`);
    if (preset.constraints.minFontSize) lines.push(`- Min font size (digital): ${preset.constraints.minFontSize}px`);
    if (preset.constraints.minFontSizePrint) lines.push(`- Min font size (print): ${preset.constraints.minFontSizePrint}pt`);
    if (preset.constraints.maxHeadlineWords) lines.push(`- Max headline length: ${preset.constraints.maxHeadlineWords} words`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run backend/tests/brands.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add plugin/src/types.ts backend/src/brands.ts backend/tests/brands.test.ts
git commit -m "feat: add brand preset CRUD and context serialization"
```

---

### Task 2: Template Sets

**Files:**
- Create: `backend/src/template-sets.ts`
- Create: `backend/tests/template-sets.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/template-sets.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot } from "../src/memory";
import {
  saveTemplateSet,
  loadTemplateSet,
  listTemplateSets,
  deleteTemplateSet,
} from "../src/template-sets";
import type { TemplateSetDef } from "../../plugin/src/types";

const TEST_DIR = path.join(__dirname, "__test_tsets__");

describe("template sets", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "template-sets"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("saves and loads a template set", () => {
    const set: TemplateSetDef = { id: "q1-social", name: "Q1 Social Campaign", formatIds: ["instagram-post", "facebook-ad", "linkedin-post"] };
    saveTemplateSet(set);
    const loaded = loadTemplateSet("q1-social");
    expect(loaded).toEqual(set);
  });

  it("returns null for non-existent set", () => {
    expect(loadTemplateSet("nope")).toBeNull();
  });

  it("lists all template sets", () => {
    saveTemplateSet({ id: "set-a", name: "A", formatIds: ["instagram-post"] });
    saveTemplateSet({ id: "set-b", name: "B", formatIds: ["facebook-ad"] });
    const sets = listTemplateSets();
    expect(sets).toHaveLength(2);
    expect(sets.map((s) => s.id)).toContain("set-a");
    expect(sets.map((s) => s.id)).toContain("set-b");
  });

  it("deletes a template set", () => {
    saveTemplateSet({ id: "del-me", name: "Delete Me", formatIds: [] });
    deleteTemplateSet("del-me");
    expect(loadTemplateSet("del-me")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run backend/tests/template-sets.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement template-sets.ts**

Create `backend/src/template-sets.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { getMemoryRoot } from "./memory";
import type { TemplateSetDef } from "../../plugin/src/types";

function setsDir(): string {
  return path.join(getMemoryRoot(), "template-sets");
}

function setPath(id: string): string {
  return path.join(setsDir(), `${id}.json`);
}

export function saveTemplateSet(set: TemplateSetDef): void {
  const dir = setsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(setPath(set.id), JSON.stringify(set, null, 2), "utf-8");
}

export function loadTemplateSet(id: string): TemplateSetDef | null {
  try {
    const raw = fs.readFileSync(setPath(id), "utf-8");
    return JSON.parse(raw) as TemplateSetDef;
  } catch {
    return null;
  }
}

export function listTemplateSets(): TemplateSetDef[] {
  const dir = setsDir();
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const raw = fs.readFileSync(path.join(dir, f), "utf-8");
        return JSON.parse(raw) as TemplateSetDef;
      });
  } catch {
    return [];
  }
}

export function deleteTemplateSet(id: string): boolean {
  try {
    fs.unlinkSync(setPath(id));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run backend/tests/template-sets.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/template-sets.ts backend/tests/template-sets.test.ts
git commit -m "feat: add template set CRUD"
```

---

### Task 3: Wire Brand Preset Into Context Merger

**Files:**
- Modify: `backend/src/context-merger.ts`
- Modify: `backend/tests/context-merger.test.ts`

- [ ] **Step 1: Add failing test**

Append to `backend/tests/context-merger.test.ts`:

```typescript
import { saveBrandPreset } from "../src/brands";
import type { BrandPreset } from "../../plugin/src/types";

describe("context merger with brand preset", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands", "acme"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "templates"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "projects"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("includes brand preset in context when available", () => {
    const preset: BrandPreset = {
      name: "Acme",
      colors: { primary: "#6B4EFF" },
      fonts: {
        headline: { family: "Inter", weight: 700 },
        body: { family: "Inter", weight: 400 },
      },
    };
    saveBrandPreset("acme", preset);
    writeMemoryFile("brands", "acme", "brand.md", "Voice: confident.");

    const ctx = mergeContext({ brandName: "acme" });
    expect(ctx).toContain("Voice: confident.");
    expect(ctx).toContain("Brand Preset: Acme");
    expect(ctx).toContain("#6B4EFF");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run backend/tests/context-merger.test.ts
```

Expected: FAIL — context doesn't contain preset info yet.

- [ ] **Step 3: Update context-merger.ts**

In `backend/src/context-merger.ts`, import brand functions and add preset to brand context:

```typescript
import { readMemoryFile, listMemoryFiles } from "./memory";
import { loadBrandPreset, brandPresetToContext } from "./brands";

export interface ContextQuery {
  brandName?: string;
  templateId?: string;
  projectName?: string;
}

export function mergeContext(query: ContextQuery): string {
  const sections: string[] = [];

  if (query.brandName) {
    const brandParts: string[] = [];

    // Markdown files
    const mdContent = readBrandContent(query.brandName);
    if (mdContent) brandParts.push(mdContent);

    // Structured preset
    const preset = loadBrandPreset(query.brandName);
    if (preset) brandParts.push(brandPresetToContext(preset));

    if (brandParts.length > 0) {
      sections.push(`## Brand Context\n\n${brandParts.join("\n\n")}`);
    }
  }

  if (query.templateId) {
    const templateContent = readMemoryFile("templates", "", `${query.templateId}.md`);
    if (templateContent) {
      sections.push(`## Template Context\n\n${templateContent}`);
    }
  }

  if (query.projectName) {
    const projectContent = readMemoryFile("projects", "", `${query.projectName}.md`);
    if (projectContent) {
      sections.push(`## Project Context (highest priority — overrides brand and template)\n\n${projectContent}`);
    }
  }

  return sections.join("\n\n---\n\n");
}

function readBrandContent(brandName: string): string | null {
  const files = listMemoryFiles("brands", brandName).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return null;
  const contents = files
    .map((f) => readMemoryFile("brands", brandName, f))
    .filter((c): c is string => c !== null);
  return contents.length > 0 ? contents.join("\n\n") : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run backend/tests/context-merger.test.ts
```

Expected: all 8 tests PASS (7 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add backend/src/context-merger.ts backend/tests/context-merger.test.ts
git commit -m "feat: include brand preset in merged reflow context"
```

---

### Task 4: Brand & Template Set API Endpoints

**Files:**
- Modify: `backend/src/server.ts`
- Create: `backend/tests/brand-api.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/brand-api.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot } from "../src/memory";
import { createApp } from "../src/server";

const TEST_DIR = path.join(__dirname, "__test_brand_api__");

async function request(app: any, method: string, urlPath: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;
      fetch(`http://localhost:${port}${urlPath}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(async (res) => {
          const data = await res.json();
          server.close();
          resolve({ status: res.status, body: data });
        })
        .catch((err) => {
          server.close();
          resolve({ status: 500, body: { error: err.message } });
        });
    });
  });
}

describe("Brand Preset API", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "template-sets"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("PUT and GET a brand preset", async () => {
    const app = createApp();
    const preset = {
      name: "Acme", colors: { primary: "#6B4EFF" },
      fonts: { headline: { family: "Inter", weight: 700 }, body: { family: "Inter", weight: 400 } },
    };
    const putRes = await request(app, "PUT", "/api/brands/acme/preset", { preset });
    expect(putRes.status).toBe(200);

    const getRes = await request(app, "GET", "/api/brands/acme/preset");
    expect(getRes.status).toBe(200);
    expect(getRes.body.preset.name).toBe("Acme");
    expect(getRes.body.preset.colors.primary).toBe("#6B4EFF");
  });

  it("LIST brands with presets", async () => {
    const app = createApp();
    const preset = { name: "A", colors: { primary: "#000" }, fonts: { headline: { family: "A", weight: 700 }, body: { family: "A", weight: 400 } } };
    await request(app, "PUT", "/api/brands/acme/preset", { preset });
    await request(app, "PUT", "/api/brands/nike/preset", { preset: { ...preset, name: "Nike" } });

    const res = await request(app, "GET", "/api/brands");
    expect(res.status).toBe(200);
    expect(res.body.brands).toContain("acme");
    expect(res.body.brands).toContain("nike");
  });

  it("GET returns 404 for missing preset", async () => {
    const app = createApp();
    const res = await request(app, "GET", "/api/brands/nope/preset");
    expect(res.status).toBe(404);
  });
});

describe("Template Set API", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "template-sets"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("PUT, GET, and LIST template sets", async () => {
    const app = createApp();
    const set = { id: "q1-social", name: "Q1 Social", formatIds: ["instagram-post", "facebook-ad"] };
    await request(app, "PUT", "/api/template-sets/q1-social", { set });

    const getRes = await request(app, "GET", "/api/template-sets/q1-social");
    expect(getRes.status).toBe(200);
    expect(getRes.body.set.name).toBe("Q1 Social");
    expect(getRes.body.set.formatIds).toEqual(["instagram-post", "facebook-ad"]);

    const listRes = await request(app, "GET", "/api/template-sets");
    expect(listRes.status).toBe(200);
    expect(listRes.body.sets).toHaveLength(1);
  });

  it("DELETE a template set", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/template-sets/del-me", { set: { id: "del-me", name: "X", formatIds: [] } });
    await request(app, "DELETE", "/api/template-sets/del-me");

    const res = await request(app, "GET", "/api/template-sets/del-me");
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run backend/tests/brand-api.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add routes to server.ts**

Add imports at top of `backend/src/server.ts`:

```typescript
import { saveBrandPreset, loadBrandPreset, listBrands } from "./brands";
import { saveTemplateSet, loadTemplateSet, listTemplateSets, deleteTemplateSet } from "./template-sets";
```

Add routes inside `createApp()`, after the memory routes:

```typescript
  // ---- Brand Preset API ----

  app.get("/api/brands", (_req, res) => {
    res.json({ brands: listBrands() });
  });

  app.get("/api/brands/:name/preset", (req, res) => {
    const preset = loadBrandPreset(req.params.name);
    if (!preset) { res.status(404).json({ error: "Brand preset not found" }); return; }
    res.json({ preset });
  });

  app.put("/api/brands/:name/preset", (req, res) => {
    const { preset } = req.body;
    if (!preset || !preset.name || !preset.colors || !preset.fonts) {
      res.status(400).json({ error: "Invalid preset: name, colors, and fonts required" });
      return;
    }
    saveBrandPreset(req.params.name, preset);
    res.json({ ok: true });
  });

  // ---- Template Set API ----

  app.get("/api/template-sets", (_req, res) => {
    res.json({ sets: listTemplateSets() });
  });

  app.get("/api/template-sets/:id", (req, res) => {
    const set = loadTemplateSet(req.params.id);
    if (!set) { res.status(404).json({ error: "Template set not found" }); return; }
    res.json({ set });
  });

  app.put("/api/template-sets/:id", (req, res) => {
    const { set } = req.body;
    if (!set || !set.id || !set.name || !Array.isArray(set.formatIds)) {
      res.status(400).json({ error: "Invalid template set: id, name, and formatIds required" });
      return;
    }
    saveTemplateSet(set);
    res.json({ ok: true });
  });

  app.delete("/api/template-sets/:id", (req, res) => {
    deleteTemplateSet(req.params.id);
    res.json({ ok: true });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run backend/tests/brand-api.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/server.ts backend/tests/brand-api.test.ts
git commit -m "feat: add brand preset and template set REST API endpoints"
```

---

### Task 5: Example Data Files

**Files:**
- Create: `memory/brands/example/preset.json`
- Create: `memory/template-sets/example-social.json`

- [ ] **Step 1: Create example brand preset**

Create `memory/brands/example/preset.json`:

```json
{
  "name": "Example Brand",
  "colors": {
    "primary": "#6B4EFF",
    "secondary": "#1E1E1E",
    "accent": "#F59E0B",
    "background": "#111111"
  },
  "fonts": {
    "headline": { "family": "Inter", "weight": 700, "transform": "uppercase" },
    "body": { "family": "Inter", "weight": 400 }
  },
  "logo": {
    "position": "bottom-right",
    "clearance": 8,
    "minSize": 40
  },
  "constraints": {
    "minFontSize": 14,
    "minFontSizePrint": 9,
    "maxHeadlineWords": 6
  }
}
```

- [ ] **Step 2: Create example template set**

Create `memory/template-sets/example-social.json`:

```json
{
  "id": "example-social",
  "name": "Social Media Essentials",
  "formatIds": [
    "instagram-post",
    "instagram-story",
    "facebook-ad",
    "linkedin-post",
    "x-post"
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add memory/brands/example/preset.json memory/template-sets/example-social.json
git commit -m "feat: add example brand preset and template set"
```

---

### Task 6: Template Set UI

**Files:**
- Modify: `plugin/src/ui.tsx`

- [ ] **Step 1: Add template set save/load to UI**

In `plugin/src/ui.tsx`, add state for template sets:

```typescript
  const [templateSets, setTemplateSets] = useState<Array<{ id: string; name: string; formatIds: string[] }>>([]);
```

Add useEffect to fetch template sets (alongside the brands/projects fetch):

```typescript
    fetch("http://localhost:3001/api/template-sets")
      .then((r) => r.json())
      .then((d) => setTemplateSets(d.sets ?? []))
      .catch(() => {});
```

Add a template set section below the format list (inside the TARGET FORMATS section, after the formatList div):

```tsx
        {/* Template set buttons */}
        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
          {templateSets.map((ts) => (
            <div key={ts.id} style={styles.subcategoryPill}
              onClick={() => setSelectedIds(new Set(ts.formatIds))}>
              {ts.name}
            </div>
          ))}
          {selectedIds.size > 0 && (
            <div style={{ ...styles.subcategoryPill, color: "#10b981", borderColor: "#10b981" }}
              onClick={() => {
                const name = prompt("Template set name:");
                if (!name) return;
                const id = name.toLowerCase().replace(/\s+/g, "-");
                const set = { id, name, formatIds: [...selectedIds] };
                fetch("http://localhost:3001/api/template-sets/" + id, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ set }),
                }).then(() => setTemplateSets((prev) => [...prev, set]));
              }}>
              + Save set
            </div>
          )}
        </div>
```

- [ ] **Step 2: Verify build**

```bash
npm run build:plugin
```

Expected: builds.

- [ ] **Step 3: Commit**

```bash
git add plugin/src/ui.tsx
git commit -m "feat: add template set save/load to plugin UI"
```

---

### Task 7: Build Verification & Push

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: all outputs created.

- [ ] **Step 3: Push**

```bash
git push
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Brand preset data model + CRUD + context serialization | 5 |
| 2 | Template set CRUD | 4 |
| 3 | Wire brand preset into context merger | 1 |
| 4 | Brand + template set REST API endpoints | 5 |
| 5 | Example data files | — |
| 6 | Template set UI (save/load) | build |
| 7 | Build verification & push | full suite |
| **Total new** | | **15 tests** |

**After this plan:** The plugin will have the complete feature set from the design spec — brand presets with colors/fonts/logo rules/constraints that feed into the reflow engine, template sets for quick format selection, and all the infrastructure for agency-grade workflow. The next evolution would be adding a real database for multi-user team management, but the file-based system works for single-team/local use.
