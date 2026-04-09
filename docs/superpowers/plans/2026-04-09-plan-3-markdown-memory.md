# Plan 3: Markdown Memory System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a layered markdown memory system where brand, template, and project context files are merged and passed to the Claude reflow engine, giving it design guidelines, platform rules, and campaign-specific instructions.

**Architecture:** Markdown files stored on the backend filesystem in `memory/brands/`, `memory/templates/`, and `memory/projects/`. A context merger reads applicable files for a given generation request, merges them (project overrides template overrides brand), and passes the result as `markdownContext` to the existing `generateReflow` function. CRUD API endpoints for managing files. Plugin UI gets a lightweight memory panel.

**Tech Stack:** TypeScript, Express (existing), Node.js fs module, existing reflow pipeline

---

## File Structure

```
Agent-figma-creative-variations/
├── backend/
│   ├── src/
│   │   ├── memory.ts                   # CRUD for markdown files (read/write/list/delete)
│   │   ├── context-merger.ts           # Merges brand + template + project → single context string
│   │   ├── server.ts                   # MODIFY: add /api/memory endpoints, wire context into reflow
│   │   └── reflow.ts                   # NO CHANGES — already accepts markdownContext
│   └── tests/
│       ├── memory.test.ts              # Unit tests for file CRUD
│       └── context-merger.test.ts      # Unit tests for merging logic
│
├── memory/                             # Root for markdown storage (gitignored)
│   ├── brands/
│   │   └── example/brand.md            # Example brand file (committed)
│   ├── templates/
│   │   └── instagram-story.md          # Example template file (committed)
│   └── projects/
│       └── example-campaign.md         # Example project file (committed)
│
├── plugin/
│   ├── src/
│   │   ├── types.ts                    # MODIFY: add MemoryContext to ReflowRequest + UIMessage
│   │   ├── code.ts                     # MODIFY: pass memoryContext in reflow requests
│   │   └── ui.tsx                      # MODIFY: add memory panel (brand/project selector)
```

---

### Task 1: Memory File CRUD

**Files:**
- Create: `backend/src/memory.ts`
- Create: `backend/tests/memory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/memory.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  listMemoryFiles,
  readMemoryFile,
  writeMemoryFile,
  deleteMemoryFile,
  setMemoryRoot,
} from "../src/memory";

const TEST_DIR = path.join(__dirname, "__test_memory__");

describe("memory CRUD", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands", "acme"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "templates"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "projects"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("writes and reads a brand file", () => {
    writeMemoryFile("brands", "acme", "brand.md", "# Acme Brand\nBe bold.");
    const content = readMemoryFile("brands", "acme", "brand.md");
    expect(content).toBe("# Acme Brand\nBe bold.");
  });

  it("writes and reads a template file", () => {
    writeMemoryFile("templates", "", "instagram-story.md", "# Instagram Story\nKeep text in middle 60%.");
    const content = readMemoryFile("templates", "", "instagram-story.md");
    expect(content).toBe("# Instagram Story\nKeep text in middle 60%.");
  });

  it("writes and reads a project file", () => {
    writeMemoryFile("projects", "", "q1-launch.md", "# Q1 Launch\nUrgent tone.");
    const content = readMemoryFile("projects", "", "q1-launch.md");
    expect(content).toBe("# Q1 Launch\nUrgent tone.");
  });

  it("lists files in a layer", () => {
    writeMemoryFile("brands", "acme", "brand.md", "content");
    writeMemoryFile("brands", "acme", "voice.md", "content");
    const files = listMemoryFiles("brands", "acme");
    expect(files).toContain("brand.md");
    expect(files).toContain("voice.md");
    expect(files).toHaveLength(2);
  });

  it("lists brand directories", () => {
    writeMemoryFile("brands", "acme", "brand.md", "content");
    writeMemoryFile("brands", "nike", "brand.md", "content");
    const dirs = listMemoryFiles("brands", "");
    expect(dirs).toContain("acme");
    expect(dirs).toContain("nike");
  });

  it("deletes a file", () => {
    writeMemoryFile("brands", "acme", "brand.md", "content");
    deleteMemoryFile("brands", "acme", "brand.md");
    const content = readMemoryFile("brands", "acme", "brand.md");
    expect(content).toBeNull();
  });

  it("returns null for non-existent file", () => {
    const content = readMemoryFile("brands", "acme", "nonexistent.md");
    expect(content).toBeNull();
  });

  it("prevents path traversal", () => {
    expect(() => writeMemoryFile("brands", "../etc", "passwd", "bad")).toThrow("Invalid path");
    expect(() => readMemoryFile("brands", "acme", "../../etc/passwd")).toThrow("Invalid path");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run backend/tests/memory.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement memory.ts**

Create `backend/src/memory.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

let memoryRoot = path.join(process.cwd(), "memory");

export function setMemoryRoot(root: string): void {
  memoryRoot = root;
}

export function getMemoryRoot(): string {
  return memoryRoot;
}

type Layer = "brands" | "templates" | "projects";

function validatePath(layer: Layer, subdir: string, filename: string): string {
  if (subdir.includes("..") || filename.includes("..")) {
    throw new Error("Invalid path: path traversal not allowed");
  }
  const parts = [memoryRoot, layer];
  if (subdir) parts.push(subdir);
  if (filename) parts.push(filename);
  const resolved = path.resolve(path.join(...parts));
  if (!resolved.startsWith(path.resolve(memoryRoot))) {
    throw new Error("Invalid path: outside memory root");
  }
  return resolved;
}

export function writeMemoryFile(layer: Layer, subdir: string, filename: string, content: string): void {
  const filePath = validatePath(layer, subdir, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

export function readMemoryFile(layer: Layer, subdir: string, filename: string): string | null {
  const filePath = validatePath(layer, subdir, filename);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function listMemoryFiles(layer: Layer, subdir: string): string[] {
  const dirPath = validatePath(layer, subdir, "");
  try {
    return fs.readdirSync(dirPath).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
}

export function deleteMemoryFile(layer: Layer, subdir: string, filename: string): boolean {
  const filePath = validatePath(layer, subdir, filename);
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run backend/tests/memory.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/memory.ts backend/tests/memory.test.ts
git commit -m "feat: add markdown memory file CRUD with path traversal protection"
```

---

### Task 2: Context Merger

**Files:**
- Create: `backend/src/context-merger.ts`
- Create: `backend/tests/context-merger.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/context-merger.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot, writeMemoryFile } from "../src/memory";
import { mergeContext } from "../src/context-merger";

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

    const ctx = mergeContext({
      brandName: "acme",
      templateId: "instagram-story",
      projectName: "q1-launch",
    });

    expect(ctx).toContain("## Brand Context");
    expect(ctx).toContain("## Template Context");
    expect(ctx).toContain("## Project Context (highest priority — overrides brand and template)");
    expect(ctx).toContain("Never use exclamation marks.");
    expect(ctx).toContain("Keep text in middle 60%.");
    expect(ctx).toContain("Urgency OK");

    // Project section should appear LAST (highest priority = read last by Claude)
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run backend/tests/context-merger.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement context-merger.ts**

Create `backend/src/context-merger.ts`:

```typescript
import { readMemoryFile, listMemoryFiles } from "./memory";

export interface ContextQuery {
  brandName?: string;
  templateId?: string;
  projectName?: string;
}

export function mergeContext(query: ContextQuery): string {
  const sections: string[] = [];

  // Layer 1: Brand (lowest priority)
  if (query.brandName) {
    const brandContent = readBrandContent(query.brandName);
    if (brandContent) {
      sections.push(`## Brand Context\n\n${brandContent}`);
    }
  }

  // Layer 2: Template
  if (query.templateId) {
    const templateContent = readMemoryFile("templates", "", `${query.templateId}.md`);
    if (templateContent) {
      sections.push(`## Template Context\n\n${templateContent}`);
    }
  }

  // Layer 3: Project (highest priority)
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

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/context-merger.ts backend/tests/context-merger.test.ts
git commit -m "feat: add context merger with layered brand/template/project priority"
```

---

### Task 3: Wire Context Into Server & Reflow

**Files:**
- Modify: `plugin/src/types.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/server.test.ts`

- [ ] **Step 1: Add MemoryContext to types**

In `plugin/src/types.ts`, add after the `PrintMeta` interface:

```typescript
export interface MemoryContext {
  brandName?: string;
  templateId?: string;
  projectName?: string;
}
```

Update `ReflowRequest` to include it:

```typescript
export interface ReflowRequest {
  frame: FrameDescriptor;
  targetWidth: number;
  targetHeight: number;
  copyVariations: Record<string, string[]>;
  printMeta?: PrintMeta;
  memoryContext?: MemoryContext;
}
```

Update `UIMessage` GENERATE variant to include it:

```typescript
export type UIMessage =
  | { type: "GENERATE"; formats: Array<{ id: string; name: string; widthPx: number; heightPx: number; printMeta?: PrintMeta }>; copyVariations: Record<string, string[]>; memoryContext?: MemoryContext }
  | { type: "CANCEL" };
```

- [ ] **Step 2: Write failing test for memory context in server**

Append to `backend/tests/server.test.ts`:

```typescript
describe("POST /api/reflow with memoryContext", () => {
  beforeEach(() => { mockGenerateReflow.mockReset(); });

  it("passes merged markdown context to generateReflow", async () => {
    mockGenerateReflow.mockResolvedValue({
      targetWidth: 1080, targetHeight: 1080,
      elements: [{ id: "text-1", x: 40, y: 200, width: 1000, height: 80, rotation: 0, visible: true }],
    });

    const request = {
      ...sampleRequest,
      copyVariations: {},
      memoryContext: { brandName: "acme", templateId: "instagram-post", projectName: "q1" },
    };

    const app = createApp();
    const res = await postJSON(app, "/api/reflow", request);

    expect(res.status).toBe(200);
    // Verify that generateReflow was called with a non-undefined markdownContext (4th param)
    const callArgs = mockGenerateReflow.mock.calls[0];
    expect(callArgs[3]).toBeDefined(); // markdownContext is now a string
    expect(typeof callArgs[3]).toBe("string");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run backend/tests/server.test.ts
```

Expected: FAIL — markdownContext is still `undefined`.

- [ ] **Step 4: Update server.ts to merge context**

In `backend/src/server.ts`, add import at top:

```typescript
import { mergeContext } from "./context-merger";
```

In the POST handler, after extracting `body` fields, add context merging. Replace both `generateReflow` calls. The handler should become:

```typescript
  app.post("/api/reflow", async (req, res) => {
    const body = req.body as Partial<ReflowRequest>;

    if (!body.frame || !body.targetWidth || !body.targetHeight) {
      res.status(400).json({ error: "Missing required fields: frame, targetWidth, targetHeight" });
      return;
    }

    const { frame, targetWidth, targetHeight, copyVariations } = body as ReflowRequest;

    try {
      // Merge markdown context from memory files
      const markdownContext = body.memoryContext
        ? mergeContext(body.memoryContext) || undefined
        : undefined;

      const variationEntries = Object.entries(copyVariations ?? {});

      if (variationEntries.length === 0) {
        const reflow = await generateReflow(frame, targetWidth, targetHeight, markdownContext, body.printMeta);
        const response: ReflowResponse = {
          variations: [{ label: "Original", textOverrides: {}, reflow }],
        };
        res.json(response);
        return;
      }

      const permutations = generatePermutations(variationEntries);
      const reflow = await generateReflow(frame, targetWidth, targetHeight, markdownContext, body.printMeta);

      const response: ReflowResponse = {
        variations: permutations.map((perm) => ({
          label: Object.values(perm)[0] ?? "Variation",
          textOverrides: perm,
          reflow,
        })),
      };

      res.json(response);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Internal server error" });
    }
  });
```

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add plugin/src/types.ts backend/src/server.ts backend/tests/server.test.ts
git commit -m "feat: wire markdown memory context into reflow pipeline"
```

---

### Task 4: Memory API Endpoints

**Files:**
- Modify: `backend/src/server.ts`
- Create: `backend/tests/memory-api.test.ts`

- [ ] **Step 1: Write failing tests for memory API**

Create `backend/tests/memory-api.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot } from "../src/memory";
import { createApp } from "../src/server";

const TEST_DIR = path.join(__dirname, "__test_memory_api__");

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

describe("Memory API", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "templates"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "projects"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("PUT and GET a brand file", async () => {
    const app = createApp();

    const putRes = await request(app, "PUT", "/api/memory/brands/acme/brand.md", {
      content: "# Acme\nBe bold.",
    });
    expect(putRes.status).toBe(200);

    const getRes = await request(app, "GET", "/api/memory/brands/acme/brand.md");
    expect(getRes.status).toBe(200);
    expect(getRes.body.content).toBe("# Acme\nBe bold.");
  });

  it("LIST files in a brand", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/brands/acme/brand.md", { content: "a" });
    await request(app, "PUT", "/api/memory/brands/acme/voice.md", { content: "b" });

    const listRes = await request(app, "GET", "/api/memory/brands/acme");
    expect(listRes.status).toBe(200);
    expect(listRes.body.files).toContain("brand.md");
    expect(listRes.body.files).toContain("voice.md");
  });

  it("LIST brands", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/brands/acme/brand.md", { content: "a" });
    await request(app, "PUT", "/api/memory/brands/nike/brand.md", { content: "b" });

    const listRes = await request(app, "GET", "/api/memory/brands");
    expect(listRes.status).toBe(200);
    expect(listRes.body.files).toContain("acme");
    expect(listRes.body.files).toContain("nike");
  });

  it("DELETE a file", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/brands/acme/brand.md", { content: "a" });
    const delRes = await request(app, "DELETE", "/api/memory/brands/acme/brand.md");
    expect(delRes.status).toBe(200);

    const getRes = await request(app, "GET", "/api/memory/brands/acme/brand.md");
    expect(getRes.status).toBe(404);
  });

  it("GET returns 404 for missing file", async () => {
    const app = createApp();
    const res = await request(app, "GET", "/api/memory/brands/nope/nope.md");
    expect(res.status).toBe(404);
  });

  it("PUT and GET a template file", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/templates/instagram-story.md", {
      content: "# Story\nMiddle 60%.",
    });
    const res = await request(app, "GET", "/api/memory/templates/instagram-story.md");
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("Middle 60%");
  });

  it("PUT and GET a project file", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/projects/q1-launch.md", {
      content: "# Q1\nUrgent.",
    });
    const res = await request(app, "GET", "/api/memory/projects/q1-launch.md");
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("Urgent");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run backend/tests/memory-api.test.ts
```

Expected: FAIL — routes don't exist.

- [ ] **Step 3: Add memory routes to server.ts**

Add these routes to `createApp()` in `backend/src/server.ts`, after the existing routes:

```typescript
  // ---- Memory API ----

  // GET /api/memory/:layer/:subdir?/:filename?
  // - GET /api/memory/brands → list brand directories
  // - GET /api/memory/brands/acme → list files in acme brand
  // - GET /api/memory/brands/acme/brand.md → read file
  // - GET /api/memory/templates/instagram-story.md → read template file
  // - GET /api/memory/projects/q1-launch.md → read project file
  app.get("/api/memory/:layer/:a?/:b?", (req, res) => {
    const { layer, a, b } = req.params;
    const validLayers = ["brands", "templates", "projects"];
    if (!validLayers.includes(layer)) {
      res.status(400).json({ error: `Invalid layer: ${layer}` });
      return;
    }

    try {
      if (!a) {
        // List top-level entries in layer
        const files = listMemoryFiles(layer as any, "");
        res.json({ files });
      } else if (!b) {
        // Could be: list files in subdir OR read a file in templates/projects
        if (a.endsWith(".md")) {
          const content = readMemoryFile(layer as any, "", a);
          if (content === null) { res.status(404).json({ error: "Not found" }); return; }
          res.json({ content });
        } else {
          const files = listMemoryFiles(layer as any, a);
          res.json({ files });
        }
      } else {
        // Read specific file in subdir (brands/acme/brand.md)
        const content = readMemoryFile(layer as any, a, b);
        if (content === null) { res.status(404).json({ error: "Not found" }); return; }
        res.json({ content });
      }
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/memory/:layer/:a/:b?
  app.put("/api/memory/:layer/:a/:b?", (req, res) => {
    const { layer, a, b } = req.params;
    const { content } = req.body;
    const validLayers = ["brands", "templates", "projects"];
    if (!validLayers.includes(layer)) {
      res.status(400).json({ error: `Invalid layer: ${layer}` });
      return;
    }
    if (typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }

    try {
      if (b) {
        writeMemoryFile(layer as any, a, b, content);
      } else {
        writeMemoryFile(layer as any, "", a, content);
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/memory/:layer/:a/:b?
  app.delete("/api/memory/:layer/:a/:b?", (req, res) => {
    const { layer, a, b } = req.params;
    const validLayers = ["brands", "templates", "projects"];
    if (!validLayers.includes(layer)) {
      res.status(400).json({ error: `Invalid layer: ${layer}` });
      return;
    }

    try {
      const deleted = b
        ? deleteMemoryFile(layer as any, a, b)
        : deleteMemoryFile(layer as any, "", a);
      res.json({ ok: deleted });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
```

Also add the imports at the top of `server.ts`:

```typescript
import { listMemoryFiles, readMemoryFile, writeMemoryFile, deleteMemoryFile } from "./memory";
import { mergeContext } from "./context-merger";
```

(Remove the duplicate `mergeContext` import if already added in Task 3.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run backend/tests/memory-api.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/server.ts backend/tests/memory-api.test.ts
git commit -m "feat: add REST API for markdown memory CRUD"
```

---

### Task 5: Example Memory Files

**Files:**
- Create: `memory/brands/example/brand.md`
- Create: `memory/templates/instagram-story.md`
- Create: `memory/projects/example-campaign.md`

- [ ] **Step 1: Create example brand file**

Create `memory/brands/example/brand.md`:

```markdown
# Example Brand Guidelines

## Voice & Tone
- Confident but not arrogant
- Technical but accessible
- Never use exclamation marks in headlines

## Visual Identity
- Primary color: #6B4EFF
- Dark backgrounds preferred for digital
- Logo must have 8% clearance on shortest edge

## Typography
- Headlines: Inter Bold, uppercase
- Body: Inter Regular, sentence case
- Min font size: 14px digital, 9pt print

## Forbidden
- No stock photos of handshakes
- No gradients on text
- Red is reserved for error states only
```

- [ ] **Step 2: Create example template file**

Create `memory/templates/instagram-story.md`:

```markdown
# Instagram Story — 1080×1920

## Safe Zones
- Top 14%: avoid (profile icon overlap)
- Bottom 20%: avoid (swipe-up / CTA area)
- Active area: middle 66% of height

## Layout Advice
- Vertical compositions work best
- One focal point per story
- Text should be readable in 2 seconds
- Max 3 text elements visible

## Typography
- Min font size: 24px (mobile readability)
- High contrast required (WCAG AA)

## Platform Notes
- Viewed at 9:16 on mobile only
- Compression is aggressive — avoid thin lines
```

- [ ] **Step 3: Create example project file**

Create `memory/projects/example-campaign.md`:

```markdown
# Example Campaign — Q1 2026

## Campaign Goal
Drive sign-ups for Pro tier. Launch date: Jan 15.

## Art Direction
- Use product screenshots (not lifestyle)
- Dark mode UI preferred
- Show dashboard feature prominently

## Tone Override
- More urgent than usual brand voice
- "Limited time" messaging OK
- CTA should emphasize "free trial"

## Specific Instructions
- Always show pricing: "$19/mo"
- Print: include QR code to landing page
- Social: hashtag #GoProNow in body text
```

- [ ] **Step 4: Commit**

```bash
git add memory/
git commit -m "feat: add example markdown memory files for brand, template, and project"
```

---

### Task 6: Memory Panel in Plugin UI

**Files:**
- Modify: `plugin/src/ui.tsx`
- Modify: `plugin/src/code.ts`

- [ ] **Step 1: Update ui.tsx to add memory selectors**

Add state variables and a memory section to the UI. In `plugin/src/ui.tsx`, add these state variables inside `App()` after the existing state:

```typescript
  const [brands, setBrands] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
```

Add a useEffect to fetch available brands and projects from the backend (add after the existing useEffects):

```typescript
  useEffect(() => {
    fetch("http://localhost:3001/api/memory/brands")
      .then((r) => r.json())
      .then((d) => setBrands(d.files ?? []))
      .catch(() => {});
    fetch("http://localhost:3001/api/memory/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.files?.filter((f: string) => f.endsWith(".md")).map((f: string) => f.replace(".md", "")) ?? []))
      .catch(() => {});
  }, []);
```

Add a memory section in the JSX, between the copy variations section and the generate button:

```tsx
      {/* Memory context */}
      {(brands.length > 0 || projects.length > 0) && (
        <div style={styles.section}>
          <div style={styles.label}>MEMORY CONTEXT</div>
          {brands.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <select style={styles.select} value={selectedBrand}
                onChange={(e) => setSelectedBrand((e.target as HTMLSelectElement).value)}>
                <option value="">No brand</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          {projects.length > 0 && (
            <div>
              <select style={styles.select} value={selectedProject}
                onChange={(e) => setSelectedProject((e.target as HTMLSelectElement).value)}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
```

Add the select style to the styles object:

```typescript
  select: {
    width: "100%", background: "#2a2a2a", border: "1px solid #444",
    borderRadius: "4px", padding: "6px 8px", color: "#e0e0e0",
    fontSize: "12px", fontFamily: "inherit",
  },
```

Update `handleGenerate` to include memoryContext in the message. In the UIMessage construction:

```typescript
    const memoryContext: any = {};
    if (selectedBrand) memoryContext.brandName = selectedBrand;
    if (selectedProject) memoryContext.projectName = selectedProject;

    const msg: UIMessage = {
      type: "GENERATE",
      formats,
      copyVariations,
      memoryContext: Object.keys(memoryContext).length > 0 ? memoryContext : undefined,
    };
```

- [ ] **Step 2: Update code.ts to pass memoryContext**

In `plugin/src/code.ts`, inside the format loop, update the request construction to include memoryContext. Add the `templateId` from the current format:

```typescript
        const memoryCtx = msg.memoryContext
          ? { ...msg.memoryContext, templateId: fmt.id }
          : undefined;

        const request: ReflowRequest = {
          frame,
          targetWidth: fmt.widthPx,
          targetHeight: fmt.heightPx,
          copyVariations: msg.copyVariations,
          printMeta: fmt.printMeta,
          memoryContext: memoryCtx,
        };
```

- [ ] **Step 3: Verify build**

```bash
npm run build:plugin
```

Expected: builds without errors.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/ui.tsx plugin/src/code.ts
git commit -m "feat: add memory context selectors to plugin UI"
```

---

### Task 7: Build Verification & Push

**Files:**
- Modify: `.gitignore` (ensure memory/ is NOT gitignored — examples should be committed)

- [ ] **Step 1: Check .gitignore**

Read `.gitignore` and ensure `memory/` is NOT listed. The example files should be committed. If `memory/` is in `.gitignore`, remove it.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Full build**

```bash
npm run build
```

Expected: all outputs created.

- [ ] **Step 4: Push**

```bash
git push
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Memory file CRUD (read/write/list/delete) | 8 |
| 2 | Context merger (brand + template + project layering) | 7 |
| 3 | Wire context into server + types | 1 |
| 4 | REST API endpoints for memory CRUD | 7 |
| 5 | Example memory files | — |
| 6 | Memory panel in plugin UI + code.ts | build |
| 7 | Build verification & push | full suite |
| **Total new** | | **23 tests** |

**After this plan:** The plugin will have a full markdown memory system. Users can create brand guidelines, template rules, and project instructions as markdown files. These get merged (project > template > brand) and passed to Claude during reflow, giving it design context for smarter layout decisions. Plan 4 will add team management and sharing on top of this.
