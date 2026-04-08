# Plan 1: Core Plugin + Backend MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end working Figma plugin that serializes a selected frame, sends it to a backend powered by Claude API, and generates reflowed variations in a new Figma page for a single target format.

**Architecture:** Figma plugin (TypeScript + esbuild) communicates with a Node.js/Express backend via HTTP. The backend uses the Anthropic SDK to analyze frame structure and return reflow instructions as structured JSON via tool_use. The plugin applies those instructions to create output frames.

**Tech Stack:** TypeScript, @anthropic-ai/sdk, Express, esbuild, Vitest, @figma/plugin-typings

---

## File Structure

```
Agent-figma-creative-variations/
├── manifest.json                        # Figma plugin manifest
├── package.json                         # Root package.json (monorepo)
├── tsconfig.json                        # Shared TypeScript config
├── .gitignore
│
├── plugin/
│   ├── src/
│   │   ├── code.ts                      # Plugin sandbox entry — orchestrates serialization + apply
│   │   ├── ui.tsx                        # Plugin UI (Preact) — frame selector, format picker, generate button
│   │   ├── serializer.ts                # Extracts frame structure → FrameDescriptor JSON
│   │   ├── applier.ts                   # Applies ReflowInstructions → creates Figma frames
│   │   └── types.ts                     # Shared types: FrameDescriptor, ReflowInstructions, messages
│   └── tests/
│       ├── serializer.test.ts           # Unit tests for frame serialization
│       └── applier.test.ts              # Unit tests for applying reflow instructions
│
├── backend/
│   ├── src/
│   │   ├── server.ts                    # Express server entry
│   │   ├── reflow.ts                    # Claude API integration — sends descriptor, returns instructions
│   │   ├── prompt.ts                    # System prompt + tool schema for Claude
│   │   └── types.ts                     # Shared types (mirrors plugin/src/types.ts)
│   └── tests/
│       ├── reflow.test.ts               # Unit tests for reflow logic (mocked Claude)
│       └── server.test.ts               # Integration tests for API endpoint
│
├── ui.html                              # Built UI output (esbuild target)
└── dist/
    └── code.js                          # Built plugin output (esbuild target)
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `manifest.json`
- Create: `plugin/src/types.ts`, `backend/src/types.ts`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/emil/Agent-figma-creative-variations
npm init -y
```

Then replace contents of `package.json`:

```json
{
  "name": "agent-figma-creative-variations",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build:plugin": "esbuild plugin/src/code.ts --bundle --outfile=dist/code.js --target=es2020 && esbuild plugin/src/ui.tsx --bundle --outfile=ui.html --loader:.tsx=tsx --inject:./plugin/src/preact-shim.ts",
    "build:backend": "esbuild backend/src/server.ts --bundle --outfile=backend/dist/server.js --platform=node --target=node18",
    "build": "npm run build:plugin && npm run build:backend",
    "dev:backend": "npx tsx backend/src/server.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@figma/plugin-typings": "^1.104.0",
    "esbuild": "^0.24.0",
    "express": "^4.21.0",
    "preact": "^10.25.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "@types/express": "^5.0.0",
    "cors": "^2.8.5",
    "@types/cors": "^2.8.17"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["plugin/src/**/*", "backend/src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
backend/dist/
ui.html
.env
.superpowers/
```

- [ ] **Step 4: Create manifest.json**

```json
{
  "name": "Creative Variations",
  "id": "creative-variations-plugin",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["http://localhost:3001"]
  }
}
```

- [ ] **Step 5: Create shared types — plugin/src/types.ts**

```typescript
// ---- Frame Descriptor (plugin → backend) ----

export interface FrameDescriptor {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: ElementDescriptor[];
}

export interface ElementDescriptor {
  id: string;
  name: string;
  type: "TEXT" | "FRAME" | "RECTANGLE" | "ELLIPSE" | "IMAGE" | "GROUP" | "OTHER";
  x: number;
  y: number;
  width: number;
  height: number;
  relativeX: number; // 0-1, percentage of parent width
  relativeY: number; // 0-1, percentage of parent height
  relativeWidth: number; // 0-1
  relativeHeight: number; // 0-1
  rotation: number;
  opacity: number;
  visible: boolean;
  // Text properties (only for TEXT type)
  text?: TextProperties;
  // Visual properties
  fills?: FillDescriptor[];
  strokes?: StrokeDescriptor[];
  effects?: EffectDescriptor[];
  cornerRadius?: number;
  // Layout
  constraints?: { horizontal: string; vertical: string };
  autoLayout?: AutoLayoutDescriptor;
  // Children (for frames/groups)
  children?: ElementDescriptor[];
}

export interface TextProperties {
  characters: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  lineHeight: number | "AUTO";
  letterSpacing: number;
  textAlignHorizontal: string;
  textAlignVertical: string;
  textTransform: string;
}

export interface FillDescriptor {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
  color?: { r: number; g: number; b: number };
  opacity?: number;
  gradientStops?: Array<{ position: number; color: { r: number; g: number; b: number; a: number } }>;
  gradientAngle?: number;
}

export interface StrokeDescriptor {
  color: { r: number; g: number; b: number };
  weight: number;
  opacity: number;
}

export interface EffectDescriptor {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  radius: number;
  offsetX?: number;
  offsetY?: number;
  color?: { r: number; g: number; b: number; a: number };
}

export interface AutoLayoutDescriptor {
  direction: "HORIZONTAL" | "VERTICAL";
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  primaryAlign: string;
  counterAlign: string;
}

// ---- Reflow Instructions (backend → plugin) ----

export interface ReflowInstructions {
  targetWidth: number;
  targetHeight: number;
  elements: ElementReflow[];
}

export interface ElementReflow {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  fontSize?: number;
  lineBreaks?: string; // reflowed text with inserted line breaks
}

// ---- Plugin ↔ UI Messages ----

export type PluginMessage =
  | { type: "SELECTION_CHANGED"; frame: { id: string; name: string; width: number; height: number; textLayerCount: number } | null }
  | { type: "GENERATION_PROGRESS"; format: string; step: string }
  | { type: "GENERATION_COMPLETE"; pageId: string }
  | { type: "ERROR"; message: string };

export type UIMessage =
  | { type: "GENERATE"; targetWidth: number; targetHeight: number; targetName: string; copyVariations: Record<string, string[]> }
  | { type: "CANCEL" };

// ---- API Request/Response ----

export interface ReflowRequest {
  frame: FrameDescriptor;
  targetWidth: number;
  targetHeight: number;
  copyVariations: Record<string, string[]>;
}

export interface ReflowResponse {
  variations: Array<{
    label: string;
    textOverrides: Record<string, string>;
    reflow: ReflowInstructions;
  }>;
}
```

- [ ] **Step 6: Create backend/src/types.ts**

```typescript
// Backend re-exports the same types
export type {
  FrameDescriptor,
  ElementDescriptor,
  TextProperties,
  FillDescriptor,
  StrokeDescriptor,
  EffectDescriptor,
  AutoLayoutDescriptor,
  ReflowInstructions,
  ElementReflow,
  ReflowRequest,
  ReflowResponse,
} from "../../plugin/src/types.js";
```

- [ ] **Step 7: Create plugin/src/preact-shim.ts**

```typescript
export { h, Fragment } from "preact";
```

- [ ] **Step 8: Create directory structure and install dependencies**

```bash
mkdir -p plugin/src plugin/tests backend/src backend/tests dist
npm install
```

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json .gitignore manifest.json plugin/src/types.ts plugin/src/preact-shim.ts backend/src/types.ts
git commit -m "feat: scaffold project with shared types and build config"
```

---

### Task 2: Frame Serializer

**Files:**
- Create: `plugin/src/serializer.ts`
- Create: `plugin/tests/serializer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `plugin/tests/serializer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FrameDescriptor } from "../src/types";

// Mock Figma API types
function createMockTextNode(overrides: Partial<any> = {}): any {
  return {
    id: "text-1",
    name: "Headline",
    type: "TEXT",
    x: 50,
    y: 100,
    width: 400,
    height: 60,
    rotation: 0,
    opacity: 1,
    visible: true,
    characters: "Hello World",
    fontSize: 48,
    fontName: { family: "Inter", style: "Bold" },
    lineHeight: { value: 56, unit: "PIXELS" },
    letterSpacing: { value: 0, unit: "PIXELS" },
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    textCase: "ORIGINAL",
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
    strokes: [],
    effects: [],
    cornerRadius: 0,
    constraints: { horizontal: "LEFT", vertical: "TOP" },
    children: undefined,
    ...overrides,
  };
}

function createMockFrame(overrides: Partial<any> = {}): any {
  return {
    id: "frame-1",
    name: "Hero Banner",
    type: "FRAME",
    width: 1200,
    height: 630,
    children: [createMockTextNode()],
    ...overrides,
  };
}

// Import after mocks are ready
import { serializeFrame } from "../src/serializer";

describe("serializeFrame", () => {
  it("serializes a frame with basic properties", () => {
    const frame = createMockFrame();
    const result = serializeFrame(frame);

    expect(result.id).toBe("frame-1");
    expect(result.name).toBe("Hero Banner");
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.elements).toHaveLength(1);
  });

  it("computes relative positions for elements", () => {
    const frame = createMockFrame();
    const result = serializeFrame(frame);
    const el = result.elements[0];

    // x=50 / 1200 ≈ 0.0417, y=100 / 630 ≈ 0.1587
    expect(el.relativeX).toBeCloseTo(50 / 1200, 4);
    expect(el.relativeY).toBeCloseTo(100 / 630, 4);
    expect(el.relativeWidth).toBeCloseTo(400 / 1200, 4);
    expect(el.relativeHeight).toBeCloseTo(60 / 630, 4);
  });

  it("extracts text properties from text nodes", () => {
    const frame = createMockFrame();
    const result = serializeFrame(frame);
    const el = result.elements[0];

    expect(el.type).toBe("TEXT");
    expect(el.text).toBeDefined();
    expect(el.text!.characters).toBe("Hello World");
    expect(el.text!.fontSize).toBe(48);
    expect(el.text!.fontFamily).toBe("Inter");
    expect(el.text!.fontWeight).toBe(700);
  });

  it("serializes fills", () => {
    const frame = createMockFrame();
    const result = serializeFrame(frame);
    const el = result.elements[0];

    expect(el.fills).toHaveLength(1);
    expect(el.fills![0].type).toBe("SOLID");
    expect(el.fills![0].color).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("handles nested children", () => {
    const nestedFrame = createMockFrame({
      id: "nested",
      name: "Card",
      type: "FRAME",
      x: 0,
      y: 0,
      width: 600,
      height: 300,
      children: [createMockTextNode({ id: "inner-text", name: "Body" })],
    });
    const frame = createMockFrame({
      children: [nestedFrame],
    });
    const result = serializeFrame(frame);

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].children).toHaveLength(1);
    expect(result.elements[0].children![0].name).toBe("Body");
  });

  it("skips invisible nodes", () => {
    const frame = createMockFrame({
      children: [createMockTextNode({ visible: false })],
    });
    const result = serializeFrame(frame);

    expect(result.elements).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run plugin/tests/serializer.test.ts
```

Expected: FAIL — `serializeFrame` not found.

- [ ] **Step 3: Implement serializeFrame**

Create `plugin/src/serializer.ts`:

```typescript
import type {
  FrameDescriptor,
  ElementDescriptor,
  TextProperties,
  FillDescriptor,
  StrokeDescriptor,
  EffectDescriptor,
  AutoLayoutDescriptor,
} from "./types";

const FONT_WEIGHT_MAP: Record<string, number> = {
  Thin: 100, ExtraLight: 200, Light: 300, Regular: 400,
  Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
};

function parseFontWeight(style: string): number {
  for (const [key, weight] of Object.entries(FONT_WEIGHT_MAP)) {
    if (style.includes(key)) return weight;
  }
  return 400;
}

function mapNodeType(type: string): ElementDescriptor["type"] {
  switch (type) {
    case "TEXT": return "TEXT";
    case "FRAME": case "COMPONENT": case "INSTANCE": return "FRAME";
    case "RECTANGLE": return "RECTANGLE";
    case "ELLIPSE": return "ELLIPSE";
    case "GROUP": return "GROUP";
    default: return "OTHER";
  }
}

function serializeFills(fills: readonly any[]): FillDescriptor[] {
  return fills
    .filter((f: any) => f.visible !== false)
    .map((f: any) => {
      const desc: FillDescriptor = { type: f.type };
      if (f.type === "SOLID") {
        desc.color = { r: f.color.r, g: f.color.g, b: f.color.b };
        desc.opacity = f.opacity ?? 1;
      }
      if (f.type === "GRADIENT_LINEAR" || f.type === "GRADIENT_RADIAL") {
        desc.gradientStops = f.gradientStops?.map((s: any) => ({
          position: s.position,
          color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
        }));
      }
      return desc;
    });
}

function serializeStrokes(strokes: readonly any[]): StrokeDescriptor[] {
  return strokes
    .filter((s: any) => s.visible !== false)
    .map((s: any) => ({
      color: { r: s.color.r, g: s.color.g, b: s.color.b },
      weight: s.weight ?? 1,
      opacity: s.opacity ?? 1,
    }));
}

function serializeEffects(effects: readonly any[]): EffectDescriptor[] {
  return effects
    .filter((e: any) => e.visible !== false)
    .map((e: any) => ({
      type: e.type,
      radius: e.radius ?? 0,
      offsetX: e.offset?.x,
      offsetY: e.offset?.y,
      color: e.color ? { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a } : undefined,
    }));
}

function serializeElement(node: any, parentWidth: number, parentHeight: number): ElementDescriptor | null {
  if (!node.visible) return null;

  const el: ElementDescriptor = {
    id: node.id,
    name: node.name,
    type: mapNodeType(node.type),
    x: node.x ?? 0,
    y: node.y ?? 0,
    width: node.width ?? 0,
    height: node.height ?? 0,
    relativeX: parentWidth > 0 ? (node.x ?? 0) / parentWidth : 0,
    relativeY: parentHeight > 0 ? (node.y ?? 0) / parentHeight : 0,
    relativeWidth: parentWidth > 0 ? (node.width ?? 0) / parentWidth : 0,
    relativeHeight: parentHeight > 0 ? (node.height ?? 0) / parentHeight : 0,
    rotation: node.rotation ?? 0,
    opacity: node.opacity ?? 1,
    visible: node.visible ?? true,
  };

  // Text properties
  if (node.type === "TEXT") {
    el.text = {
      characters: node.characters ?? "",
      fontSize: typeof node.fontSize === "number" ? node.fontSize : 16,
      fontFamily: node.fontName?.family ?? "Inter",
      fontWeight: parseFontWeight(node.fontName?.style ?? "Regular"),
      lineHeight: node.lineHeight?.unit === "PIXELS" ? node.lineHeight.value : "AUTO",
      letterSpacing: node.letterSpacing?.value ?? 0,
      textAlignHorizontal: node.textAlignHorizontal ?? "LEFT",
      textAlignVertical: node.textAlignVertical ?? "TOP",
      textTransform: node.textCase ?? "ORIGINAL",
    };
  }

  // Visual properties
  if (node.fills && node.fills.length > 0) {
    el.fills = serializeFills(node.fills);
  }
  if (node.strokes && node.strokes.length > 0) {
    el.strokes = serializeStrokes(node.strokes);
  }
  if (node.effects && node.effects.length > 0) {
    el.effects = serializeEffects(node.effects);
  }
  if (node.cornerRadius != null && node.cornerRadius > 0) {
    el.cornerRadius = node.cornerRadius;
  }
  if (node.constraints) {
    el.constraints = {
      horizontal: node.constraints.horizontal,
      vertical: node.constraints.vertical,
    };
  }

  // Auto-layout
  if (node.layoutMode && node.layoutMode !== "NONE") {
    el.autoLayout = {
      direction: node.layoutMode,
      gap: node.itemSpacing ?? 0,
      paddingTop: node.paddingTop ?? 0,
      paddingRight: node.paddingRight ?? 0,
      paddingBottom: node.paddingBottom ?? 0,
      paddingLeft: node.paddingLeft ?? 0,
      primaryAlign: node.primaryAxisAlignItems ?? "MIN",
      counterAlign: node.counterAxisAlignItems ?? "MIN",
    };
  }

  // Children
  if (node.children && node.children.length > 0) {
    el.children = node.children
      .map((child: any) => serializeElement(child, node.width, node.height))
      .filter((c: ElementDescriptor | null): c is ElementDescriptor => c !== null);
  }

  return el;
}

export function serializeFrame(frame: any): FrameDescriptor {
  const elements = (frame.children ?? [])
    .map((child: any) => serializeElement(child, frame.width, frame.height))
    .filter((el: ElementDescriptor | null): el is ElementDescriptor => el !== null);

  return {
    id: frame.id,
    name: frame.name,
    width: frame.width,
    height: frame.height,
    elements,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run plugin/tests/serializer.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/serializer.ts plugin/tests/serializer.test.ts
git commit -m "feat: add frame serializer with relative position computation"
```

---

### Task 3: Backend — Claude Reflow Engine

**Files:**
- Create: `backend/src/prompt.ts`
- Create: `backend/src/reflow.ts`
- Create: `backend/tests/reflow.test.ts`

- [ ] **Step 1: Create the Claude prompt and tool schema**

Create `backend/src/prompt.ts`:

```typescript
export const REFLOW_SYSTEM_PROMPT = `You are a design layout reflow engine. You receive a JSON descriptor of a Figma frame and a target size. Your job is to generate precise layout instructions that adapt the design to the new dimensions.

Core principles:
1. RELATIONSHIPS OVER COORDINATES — encode spatial relationships as ratios, not absolute pixels
2. PRESERVE HIERARCHY — if headline is 2× body text, maintain that ratio
3. PRESERVE SPACING RHYTHM — if gaps follow a scale (4/8/16), keep the scale
4. SMART RESTRUCTURING — side-by-side layouts become stacked when aspect ratio demands it
5. MINIMUM READABILITY — never set font size below 10px

For each element, output its new position (x, y), size (width, height), rotation, and visibility.
For text elements, also output adjusted fontSize and reflowed text (lineBreaks) if the text needs to wrap differently.

If an element cannot fit in the target at readable size, set visible to false and explain in a comment.

Always call the reflow_layout tool. Never respond with plain text.`;

export const REFLOW_TOOL = {
  name: "reflow_layout" as const,
  description: "Output structured layout reflow instructions for a target format",
  input_schema: {
    type: "object" as const,
    properties: {
      targetWidth: { type: "number" as const, description: "Target frame width in pixels" },
      targetHeight: { type: "number" as const, description: "Target frame height in pixels" },
      elements: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            id: { type: "string" as const },
            x: { type: "number" as const },
            y: { type: "number" as const },
            width: { type: "number" as const },
            height: { type: "number" as const },
            rotation: { type: "number" as const },
            visible: { type: "boolean" as const },
            fontSize: { type: "number" as const, description: "Adjusted font size (text elements only)" },
            lineBreaks: { type: "string" as const, description: "Reflowed text with line breaks (text elements only)" },
          },
          required: ["id", "x", "y", "width", "height", "rotation", "visible"],
        },
      },
    },
    required: ["targetWidth", "targetHeight", "elements"],
  },
};
```

- [ ] **Step 2: Write failing tests for reflow**

Create `backend/tests/reflow.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FrameDescriptor, ReflowInstructions } from "../src/types";

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { generateReflow } from "../src/reflow";

const sampleFrame: FrameDescriptor = {
  id: "frame-1",
  name: "Hero Banner",
  width: 1200,
  height: 630,
  elements: [
    {
      id: "text-1",
      name: "Headline",
      type: "TEXT",
      x: 50,
      y: 100,
      width: 400,
      height: 60,
      relativeX: 50 / 1200,
      relativeY: 100 / 630,
      relativeWidth: 400 / 1200,
      relativeHeight: 60 / 630,
      rotation: 0,
      opacity: 1,
      visible: true,
      text: {
        characters: "Hello World",
        fontSize: 48,
        fontFamily: "Inter",
        fontWeight: 700,
        lineHeight: 56,
        letterSpacing: 0,
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        textTransform: "ORIGINAL",
      },
    },
  ],
};

describe("generateReflow", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("calls Claude API with frame descriptor and target size", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "reflow_layout",
          input: {
            targetWidth: 1080,
            targetHeight: 1080,
            elements: [
              { id: "text-1", x: 40, y: 200, width: 1000, height: 80, rotation: 0, visible: true, fontSize: 42 },
            ],
          },
        },
      ],
    });

    const result = await generateReflow(sampleFrame, 1080, 1080);

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(result.targetWidth).toBe(1080);
    expect(result.targetHeight).toBe(1080);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].id).toBe("text-1");
    expect(result.elements[0].fontSize).toBe(42);
  });

  it("throws if Claude does not call the tool", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot process this." }],
    });

    await expect(generateReflow(sampleFrame, 1080, 1080)).rejects.toThrow(
      "Claude did not return reflow instructions"
    );
  });

  it("passes the system prompt and tool definition", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "reflow_layout",
          input: { targetWidth: 1080, targetHeight: 1080, elements: [] },
        },
      ],
    });

    await generateReflow(sampleFrame, 1080, 1080);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBeDefined();
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools[0].name).toBe("reflow_layout");
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "reflow_layout" });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run backend/tests/reflow.test.ts
```

Expected: FAIL — `generateReflow` not found.

- [ ] **Step 4: Implement generateReflow**

Create `backend/src/reflow.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { FrameDescriptor, ReflowInstructions } from "./types";
import { REFLOW_SYSTEM_PROMPT, REFLOW_TOOL } from "./prompt";

const client = new Anthropic();

export async function generateReflow(
  frame: FrameDescriptor,
  targetWidth: number,
  targetHeight: number,
  markdownContext?: string,
): Promise<ReflowInstructions> {
  const systemPrompt = markdownContext
    ? `${REFLOW_SYSTEM_PROMPT}\n\n## Additional Context\n\n${markdownContext}`
    : REFLOW_SYSTEM_PROMPT;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Reflow this frame from ${frame.width}×${frame.height} to ${targetWidth}×${targetHeight}.\n\nFrame descriptor:\n${JSON.stringify(frame, null, 2)}`,
      },
    ],
    tools: [REFLOW_TOOL],
    tool_choice: { type: "tool", name: "reflow_layout" },
  });

  const toolUseBlock = response.content.find(
    (block) => block.type === "tool_use" && block.name === "reflow_layout"
  );

  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Claude did not return reflow instructions");
  }

  return toolUseBlock.input as ReflowInstructions;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run backend/tests/reflow.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/prompt.ts backend/src/reflow.ts backend/tests/reflow.test.ts
git commit -m "feat: add Claude-powered reflow engine with tool_use"
```

---

### Task 4: Backend — Express Server

**Files:**
- Create: `backend/src/server.ts`
- Create: `backend/tests/server.test.ts`

- [ ] **Step 1: Write failing tests for the API endpoint**

Create `backend/tests/server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock reflow module
const mockGenerateReflow = vi.fn();
vi.mock("../src/reflow", () => ({
  generateReflow: mockGenerateReflow,
}));

import { createApp } from "../src/server";
import type { ReflowRequest } from "../src/types";

// Minimal test helper — uses Express directly without supertest
async function postJSON(app: any, path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;
      fetch(`http://localhost:${port}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

const sampleRequest: ReflowRequest = {
  frame: {
    id: "frame-1",
    name: "Hero",
    width: 1200,
    height: 630,
    elements: [
      {
        id: "text-1",
        name: "Headline",
        type: "TEXT",
        x: 50, y: 100, width: 400, height: 60,
        relativeX: 0.042, relativeY: 0.159, relativeWidth: 0.333, relativeHeight: 0.095,
        rotation: 0, opacity: 1, visible: true,
        text: {
          characters: "Hello", fontSize: 48, fontFamily: "Inter", fontWeight: 700,
          lineHeight: 56, letterSpacing: 0, textAlignHorizontal: "LEFT",
          textAlignVertical: "TOP", textTransform: "ORIGINAL",
        },
      },
    ],
  },
  targetWidth: 1080,
  targetHeight: 1080,
  copyVariations: { "text-1": ["Hello World", "Hey There"] },
};

describe("POST /api/reflow", () => {
  beforeEach(() => {
    mockGenerateReflow.mockReset();
  });

  it("returns reflow instructions for each variation", async () => {
    mockGenerateReflow.mockResolvedValue({
      targetWidth: 1080,
      targetHeight: 1080,
      elements: [{ id: "text-1", x: 40, y: 200, width: 1000, height: 80, rotation: 0, visible: true, fontSize: 42 }],
    });

    const app = createApp();
    const res = await postJSON(app, "/api/reflow", sampleRequest);

    expect(res.status).toBe(200);
    expect(res.body.variations).toHaveLength(2);
    expect(res.body.variations[0].label).toBe("Hello World");
    expect(res.body.variations[0].textOverrides).toEqual({ "text-1": "Hello World" });
    expect(res.body.variations[1].label).toBe("Hey There");
  });

  it("returns 400 if frame is missing", async () => {
    const app = createApp();
    const res = await postJSON(app, "/api/reflow", { targetWidth: 1080, targetHeight: 1080 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 500 if reflow fails", async () => {
    mockGenerateReflow.mockRejectedValue(new Error("API error"));

    const app = createApp();
    const res = await postJSON(app, "/api/reflow", sampleRequest);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("API error");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run backend/tests/server.test.ts
```

Expected: FAIL — `createApp` not found.

- [ ] **Step 3: Implement the Express server**

Create `backend/src/server.ts`:

```typescript
import express from "express";
import cors from "cors";
import { generateReflow } from "./reflow";
import type { ReflowRequest, ReflowResponse } from "./types";

export function createApp(): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.post("/api/reflow", async (req, res) => {
    const body = req.body as Partial<ReflowRequest>;

    if (!body.frame || !body.targetWidth || !body.targetHeight) {
      res.status(400).json({ error: "Missing required fields: frame, targetWidth, targetHeight" });
      return;
    }

    const { frame, targetWidth, targetHeight, copyVariations } = body as ReflowRequest;

    try {
      // Find all text layer IDs that have variations
      const variationEntries = Object.entries(copyVariations ?? {});

      // If no copy variations, generate a single reflow with original text
      if (variationEntries.length === 0) {
        const reflow = await generateReflow(frame, targetWidth, targetHeight);
        const response: ReflowResponse = {
          variations: [{ label: "Original", textOverrides: {}, reflow }],
        };
        res.json(response);
        return;
      }

      // Generate permutations of copy variations
      const permutations = generatePermutations(variationEntries);

      // For MVP: reflow once, apply text overrides per permutation
      // (The layout is the same — only text content changes)
      const reflow = await generateReflow(frame, targetWidth, targetHeight);

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

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

function generatePermutations(entries: [string, string[]][]): Record<string, string>[] {
  if (entries.length === 0) return [{}];

  const [id, values] = entries[0];
  const rest = generatePermutations(entries.slice(1));

  return values.flatMap((value) =>
    rest.map((perm) => ({ [id]: value, ...perm }))
  );
}

// Start server if run directly
const port = process.env.PORT ?? 3001;
if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  app.listen(port, () => {
    console.log(`Creative Variations backend running on http://localhost:${port}`);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run backend/tests/server.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/server.ts backend/tests/server.test.ts
git commit -m "feat: add Express server with /api/reflow endpoint"
```

---

### Task 5: Reflow Applier

**Files:**
- Create: `plugin/src/applier.ts`
- Create: `plugin/tests/applier.test.ts`

- [ ] **Step 1: Write failing tests**

Create `plugin/tests/applier.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReflowInstructions } from "../src/types";

// Mock Figma globals
const mockPage: any = {
  name: "",
  appendChild: vi.fn(),
};

const mockClonedFrame: any = {
  name: "",
  resize: vi.fn(),
  children: [],
  appendChild: vi.fn(),
};

const mockClonedText: any = {
  id: "text-1",
  type: "TEXT",
  name: "Headline",
  x: 50,
  y: 100,
  resize: vi.fn(),
  rotation: 0,
  visible: true,
  characters: "Original",
  fontSize: 48,
};

const mockSourceFrame: any = {
  id: "frame-1",
  name: "Hero Banner",
  width: 1200,
  height: 630,
  clone: vi.fn(() => ({
    ...mockClonedFrame,
    findAll: vi.fn(() => [mockClonedText]),
  })),
};

vi.stubGlobal("figma", {
  createPage: vi.fn(() => mockPage),
  root: { appendChild: vi.fn() },
  getNodeById: vi.fn((id: string) => {
    if (id === "frame-1") return mockSourceFrame;
    return null;
  }),
  loadFontAsync: vi.fn().mockResolvedValue(undefined),
});

import { applyReflow } from "../src/applier";

describe("applyReflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSourceFrame.clone.mockReturnValue({
      ...mockClonedFrame,
      name: "",
      resize: vi.fn(),
      findAll: vi.fn(() => [{ ...mockClonedText }]),
    });
  });

  it("creates a new page with the target format name", async () => {
    const instructions: ReflowInstructions = {
      targetWidth: 1080,
      targetHeight: 1080,
      elements: [
        { id: "text-1", x: 40, y: 200, width: 1000, height: 80, rotation: 0, visible: true, fontSize: 42 },
      ],
    };

    await applyReflow(
      "frame-1",
      "Instagram Post",
      [{ label: "Hello World", textOverrides: { "text-1": "Hello World" }, reflow: instructions }],
    );

    expect(figma.createPage).toHaveBeenCalled();
    expect(mockPage.name).toBe("Instagram Post");
    expect(figma.root.appendChild).toHaveBeenCalledWith(mockPage);
  });

  it("clones the source frame for each variation", async () => {
    const instructions: ReflowInstructions = {
      targetWidth: 1080,
      targetHeight: 1080,
      elements: [],
    };

    await applyReflow(
      "frame-1",
      "Instagram Post",
      [
        { label: "Var A", textOverrides: {}, reflow: instructions },
        { label: "Var B", textOverrides: {}, reflow: instructions },
      ],
    );

    expect(mockSourceFrame.clone).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run plugin/tests/applier.test.ts
```

Expected: FAIL — `applyReflow` not found.

- [ ] **Step 3: Implement applyReflow**

Create `plugin/src/applier.ts`:

```typescript
import type { ReflowInstructions, ElementReflow, ReflowResponse } from "./types";

export async function applyReflow(
  sourceFrameId: string,
  formatName: string,
  variations: ReflowResponse["variations"],
): Promise<void> {
  const sourceFrame = figma.getNodeById(sourceFrameId) as FrameNode;
  if (!sourceFrame) throw new Error(`Source frame ${sourceFrameId} not found`);

  // Create a new page for this format
  const page = figma.createPage();
  page.name = formatName;
  figma.root.appendChild(page);

  let xOffset = 0;
  const gap = 40;

  for (const variation of variations) {
    const clone = sourceFrame.clone();
    clone.name = `${formatName} / ${variation.label}`;

    // Resize the cloned frame to target dimensions
    clone.resize(variation.reflow.targetWidth, variation.reflow.targetHeight);

    // Apply element reflows
    const allNodes = clone.findAll(() => true);
    const nodeMap = new Map<string, SceneNode>();
    for (const node of allNodes) {
      nodeMap.set(node.id, node);
    }

    // Build ID mapping: source IDs → cloned IDs
    // Figma clone preserves structure but assigns new IDs.
    // We match by index in a depth-first traversal of source vs clone.
    const sourceNodes = (sourceFrame as FrameNode).findAll(() => true);
    const idMap = new Map<string, SceneNode>();
    for (let i = 0; i < sourceNodes.length && i < allNodes.length; i++) {
      idMap.set(sourceNodes[i].id, allNodes[i]);
    }

    for (const elReflow of variation.reflow.elements) {
      const node = idMap.get(elReflow.id);
      if (!node) continue;

      // Position and size
      node.x = elReflow.x;
      node.y = elReflow.y;
      if ("resize" in node) {
        (node as any).resize(elReflow.width, elReflow.height);
      }
      node.rotation = elReflow.rotation;
      node.visible = elReflow.visible;

      // Text overrides
      if (node.type === "TEXT") {
        const textNode = node as TextNode;
        // Load font before modifying text
        if (textNode.fontName !== figma.mixed) {
          await figma.loadFontAsync(textNode.fontName as FontName);
        }

        // Apply copy variation
        const override = variation.textOverrides[elReflow.id];
        if (override) {
          textNode.characters = elReflow.lineBreaks ?? override;
        } else if (elReflow.lineBreaks) {
          textNode.characters = elReflow.lineBreaks;
        }

        // Apply font size
        if (elReflow.fontSize != null) {
          textNode.fontSize = elReflow.fontSize;
        }
      }
    }

    // Position on page
    clone.x = xOffset;
    clone.y = 0;
    page.appendChild(clone);
    xOffset += variation.reflow.targetWidth + gap;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run plugin/tests/applier.test.ts
```

Expected: all 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/applier.ts plugin/tests/applier.test.ts
git commit -m "feat: add reflow applier that creates output pages with variations"
```

---

### Task 6: Plugin Sandbox (code.ts)

**Files:**
- Create: `plugin/src/code.ts`

- [ ] **Step 1: Implement the plugin sandbox entry**

Create `plugin/src/code.ts`:

```typescript
import { serializeFrame } from "./serializer";
import { applyReflow } from "./applier";
import type { PluginMessage, UIMessage, ReflowRequest, ReflowResponse } from "./types";

const BACKEND_URL = "http://localhost:3001";

figma.showUI(__html__, { width: 400, height: 600 });

// Watch selection changes
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

// Handle messages from UI
figma.ui.on("message", async (msg: UIMessage) => {
  if (msg.type === "GENERATE") {
    try {
      const sel = figma.currentPage.selection[0];
      if (!sel || sel.type !== "FRAME") {
        figma.ui.postMessage({ type: "ERROR", message: "No frame selected" } as PluginMessage);
        return;
      }

      figma.ui.postMessage({
        type: "GENERATION_PROGRESS",
        format: msg.targetName,
        step: "Serializing frame...",
      } as PluginMessage);

      // Step 1: Serialize
      const frame = serializeFrame(sel);

      figma.ui.postMessage({
        type: "GENERATION_PROGRESS",
        format: msg.targetName,
        step: "Sending to reflow engine...",
      } as PluginMessage);

      // Step 2: Send to backend
      const request: ReflowRequest = {
        frame,
        targetWidth: msg.targetWidth,
        targetHeight: msg.targetHeight,
        copyVariations: msg.copyVariations,
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

      figma.ui.postMessage({
        type: "GENERATION_PROGRESS",
        format: msg.targetName,
        step: "Applying reflow...",
      } as PluginMessage);

      // Step 3: Apply
      await applyReflow(sel.id, msg.targetName, data.variations);

      figma.ui.postMessage({
        type: "GENERATION_COMPLETE",
        pageId: "done",
      } as PluginMessage);

      figma.notify(`✓ Generated ${data.variations.length} variations for ${msg.targetName}`);
    } catch (err: any) {
      figma.ui.postMessage({ type: "ERROR", message: err.message } as PluginMessage);
      figma.notify(`✗ Error: ${err.message}`, { error: true });
    }
  }
});
```

- [ ] **Step 2: Update manifest.json networkAccess**

The plugin needs to make fetch calls to the backend. Update `manifest.json`:

```json
{
  "name": "Creative Variations",
  "id": "creative-variations-plugin",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["http://localhost:3001"],
    "reasoning": "Connects to local backend for AI-powered layout reflow"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add plugin/src/code.ts manifest.json
git commit -m "feat: add plugin sandbox orchestrating serialize → reflow → apply"
```

---

### Task 7: Plugin UI

**Files:**
- Create: `plugin/src/ui.tsx`

- [ ] **Step 1: Implement the plugin UI**

Create `plugin/src/ui.tsx`:

```tsx
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import type { PluginMessage, UIMessage } from "./types";

interface FrameInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  textLayerCount: number;
}

// MVP: hardcoded format presets (will be expanded in Plan 2)
const FORMATS = [
  { name: "Instagram Post", width: 1080, height: 1080, category: "Digital" },
  { name: "Instagram Story", width: 1080, height: 1920, category: "Digital" },
  { name: "Facebook Ad", width: 1200, height: 628, category: "Digital" },
  { name: "LinkedIn Post", width: 1200, height: 627, category: "Digital" },
  { name: "YouTube Thumbnail", width: 1280, height: 720, category: "Digital" },
  { name: "A4 Flyer", width: 2480, height: 3508, category: "Print" },
];

function App() {
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<typeof FORMATS[0] | null>(null);
  const [copyText, setCopyText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case "SELECTION_CHANGED":
          setFrame(msg.frame);
          break;
        case "GENERATION_PROGRESS":
          setStatus(`${msg.format}: ${msg.step}`);
          break;
        case "GENERATION_COMPLETE":
          setStatus("Done!");
          setGenerating(false);
          break;
        case "ERROR":
          setStatus(`Error: ${msg.message}`);
          setGenerating(false);
          break;
      }
    };
  }, []);

  function handleGenerate() {
    if (!frame || !selectedFormat) return;

    setGenerating(true);
    setStatus("Starting...");

    // Parse copy variations: each line is a variation for the first text layer
    // MVP: applies to all text layers equally. Plan 2 will add per-layer input.
    const lines = copyText.split("\n").filter((l) => l.trim());
    const copyVariations: Record<string, string[]> = {};
    if (lines.length > 0) {
      // For MVP, we don't know text layer IDs from the UI.
      // We use a placeholder key — the backend will match to the first text layer.
      copyVariations["__all__"] = lines;
    }

    const msg: UIMessage = {
      type: "GENERATE",
      targetWidth: selectedFormat.width,
      targetHeight: selectedFormat.height,
      targetName: selectedFormat.name,
      copyVariations,
    };

    parent.postMessage({ pluginMessage: msg }, "*");
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Creative Variations</span>
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

      {/* Format picker */}
      <div style={styles.section}>
        <div style={styles.label}>TARGET FORMAT</div>
        <div style={styles.formatList}>
          {FORMATS.map((fmt) => (
            <div
              key={fmt.name}
              style={{
                ...styles.formatItem,
                ...(selectedFormat?.name === fmt.name ? styles.formatItemSelected : {}),
              }}
              onClick={() => setSelectedFormat(fmt)}
            >
              <span>{fmt.name}</span>
              <span style={styles.formatSize}>{fmt.width}×{fmt.height}</span>
            </div>
          ))}
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
        style={{
          ...styles.generateButton,
          ...((!frame || !selectedFormat || generating) ? styles.generateButtonDisabled : {}),
        }}
        onClick={handleGenerate}
        disabled={!frame || !selectedFormat || generating}
      >
        {generating ? "Generating..." : `Generate ${selectedFormat ? selectedFormat.name : ""}`}
      </button>

      {/* Status */}
      {status && <div style={styles.status}>{status}</div>}
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "13px",
    color: "#e0e0e0",
    background: "#1e1e1e",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid #333",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontWeight: "600", fontSize: "14px" },
  section: { padding: "12px 16px" },
  label: {
    fontSize: "11px",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: "8px",
    letterSpacing: "0.5px",
  },
  frameInfo: {
    background: "#2a2a2a",
    border: "1px dashed #555",
    borderRadius: "6px",
    padding: "12px",
    textAlign: "center",
  },
  frameName: { color: "#a78bfa" },
  frameMeta: { fontSize: "11px", color: "#666", marginTop: "4px" },
  emptyState: {
    background: "#2a2a2a",
    border: "1px dashed #444",
    borderRadius: "6px",
    padding: "24px",
    textAlign: "center",
    color: "#666",
  },
  formatList: { display: "flex", flexDirection: "column", gap: "4px" },
  formatItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  formatItemSelected: {
    background: "rgba(167, 139, 250, 0.15)",
    outline: "1px solid #a78bfa",
  },
  formatSize: { fontSize: "11px", color: "#666" },
  textarea: {
    width: "100%",
    background: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: "4px",
    padding: "8px",
    color: "#e0e0e0",
    fontSize: "12px",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },
  generateButton: {
    margin: "12px 16px",
    padding: "10px",
    background: "#a78bfa",
    color: "#1e1e1e",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    textAlign: "center",
  },
  generateButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  status: {
    padding: "8px 16px",
    fontSize: "12px",
    color: "#888",
    textAlign: "center",
  },
};

render(<App />, document.getElementById("root")!);
```

- [ ] **Step 2: Verify build works**

```bash
cd /Users/emil/Agent-figma-creative-variations && npm run build:plugin
```

Expected: `dist/code.js` and `ui.html` are created without errors.

- [ ] **Step 3: Commit**

```bash
git add plugin/src/ui.tsx
git commit -m "feat: add plugin UI with frame selector, format picker, and copy input"
```

---

### Task 8: End-to-End Integration Test

**Files:**
- Create: `backend/tests/integration.test.ts`

- [ ] **Step 1: Write an integration test that verifies the full backend flow**

Create `backend/tests/integration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReflowRequest } from "../src/types";

// Mock Claude API at SDK level
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { createApp } from "../src/server";

async function postJSON(app: any, path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;
      fetch(`http://localhost:${port}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

describe("end-to-end reflow", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("serialized frame → Claude reflow → structured response with variations", async () => {
    // Claude returns reflow instructions via tool_use
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "reflow_layout",
          input: {
            targetWidth: 1080,
            targetHeight: 1080,
            elements: [
              {
                id: "text-1",
                x: 40,
                y: 400,
                width: 1000,
                height: 100,
                rotation: 0,
                visible: true,
                fontSize: 42,
                lineBreaks: "Think Different.\nBuild Better.",
              },
              {
                id: "img-1",
                x: 40,
                y: 40,
                width: 1000,
                height: 340,
                rotation: 0,
                visible: true,
              },
            ],
          },
        },
      ],
    });

    const request: ReflowRequest = {
      frame: {
        id: "frame-1",
        name: "Hero Banner",
        width: 1200,
        height: 630,
        elements: [
          {
            id: "text-1",
            name: "Headline",
            type: "TEXT",
            x: 50, y: 100, width: 500, height: 60,
            relativeX: 0.042, relativeY: 0.159, relativeWidth: 0.417, relativeHeight: 0.095,
            rotation: 0, opacity: 1, visible: true,
            text: {
              characters: "Original Headline",
              fontSize: 48, fontFamily: "Inter", fontWeight: 700,
              lineHeight: 56, letterSpacing: 0,
              textAlignHorizontal: "LEFT", textAlignVertical: "TOP", textTransform: "ORIGINAL",
            },
          },
          {
            id: "img-1",
            name: "Hero Image",
            type: "IMAGE",
            x: 600, y: 50, width: 550, height: 530,
            relativeX: 0.5, relativeY: 0.079, relativeWidth: 0.458, relativeHeight: 0.841,
            rotation: 0, opacity: 1, visible: true,
          },
        ],
      },
      targetWidth: 1080,
      targetHeight: 1080,
      copyVariations: {
        "text-1": ["Think Different. Build Better.", "Design Without Limits."],
      },
    };

    const app = createApp();
    const res = await postJSON(app, "/api/reflow", request);

    // Verify response structure
    expect(res.status).toBe(200);
    expect(res.body.variations).toHaveLength(2);

    // First variation
    expect(res.body.variations[0].label).toBe("Think Different. Build Better.");
    expect(res.body.variations[0].textOverrides["text-1"]).toBe("Think Different. Build Better.");
    expect(res.body.variations[0].reflow.targetWidth).toBe(1080);
    expect(res.body.variations[0].reflow.elements).toHaveLength(2);

    // Second variation
    expect(res.body.variations[1].label).toBe("Design Without Limits.");

    // Verify Claude was called with the right structure
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-5");
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "reflow_layout" });
    expect(callArgs.messages[0].content).toContain("1200×630");
    expect(callArgs.messages[0].content).toContain("1080×1080");
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
npx vitest run backend/tests/integration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS (serializer: 6, reflow: 3, server: 3, integration: 1, applier: 2 = 15 tests).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration.test.ts
git commit -m "test: add end-to-end integration test for reflow pipeline"
```

---

### Task 9: Build Verification & README

**Files:**
- Create: `backend/.env.example`

- [ ] **Step 1: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3001
```

- [ ] **Step 2: Verify full build**

```bash
cd /Users/emil/Agent-figma-creative-variations
npm run build
```

Expected: `dist/code.js`, `ui.html`, and `backend/dist/server.js` all created.

- [ ] **Step 3: Run all tests one final time**

```bash
npx vitest run
```

Expected: all 15 tests PASS.

- [ ] **Step 4: Commit and push**

```bash
git add backend/.env.example
git commit -m "chore: add env example and verify build"
git push -u origin main
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Project scaffold + shared types | — |
| 2 | Frame serializer | 6 |
| 3 | Claude reflow engine | 3 |
| 4 | Express server + API endpoint | 3 |
| 5 | Reflow applier | 2 |
| 6 | Plugin sandbox (code.ts) | — |
| 7 | Plugin UI | build check |
| 8 | End-to-end integration test | 1 |
| 9 | Build verification | full suite |
| **Total** | | **15 tests** |

**After this plan:** The plugin will serialize a frame, send it to the Claude-powered backend, receive reflow instructions, and create variation frames on a new Figma page. It supports a single target format per run with copy variations. Plans 2-4 will add the full template library, markdown memory, and team management.
