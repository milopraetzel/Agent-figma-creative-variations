# Creative Variations — Figma Plugin

Generate creative variations across multiple aspect ratios and formats with AI-powered layout reflow. One frame in, dozens of production-ready creatives out.

Built for agencies and studios. Supports digital (social, display, video, email) and print (DIN, US, posters, business cards) formats with intelligent layout adaptation powered by Claude.

---

## What it does

1. **Select** a source frame in Figma
2. **Pick** target formats — Instagram Post, Facebook Ad, A4 Flyer, or any of 43 built-in templates
3. **Paste** headline/copy variations (one per line)
4. **Generate** — the plugin creates a new page per format with all copy permutations, intelligently reflowed

The reflow engine doesn't just scale — it understands your design. Side-by-side layouts become stacked in portrait. Typography hierarchy is preserved. Print formats get bleed zones and safe areas. Abstract compositions maintain their spatial relationships.

---

## Features

### 43 Format Templates

| Category | Subcategories |
|----------|--------------|
| **Digital** | Social Media (11), Display Ads (6), Video (4), Email & Web (3) |
| **Print** | DIN Standard (5), US Standard (4), Posters & Signage (5), Business (4) |

Multi-select formats. Save groups as **Template Sets** for quick reuse.

### AI-Powered Reflow

Claude analyzes your design structure — not just coordinates — and decides how to adapt it:

- **Relationships over coordinates** — margins, gaps, and positions encoded as ratios
- **Typography hierarchy preserved** — if headline is 2x body, that ratio holds
- **Smart restructuring** — landscape layouts become stacked in portrait
- **Print-aware** — 300 DPI, bleed margins, safe zones, font sizes in pt

### Markdown Memory System

Three layers of context that guide the reflow engine:

| Layer | Scope | Example |
|-------|-------|---------|
| **Brand** | All creatives for a brand | Voice, colors, logo rules, forbidden patterns |
| **Template** | All creatives in a format | Platform safe zones, layout advice |
| **Project** | This campaign only | Art direction, tone overrides, specific assets |

Project overrides template overrides brand. Plain markdown files — editable anywhere, version-controllable.

### Brand Presets

Structured brand configurations:

- Colors (primary, secondary, accent)
- Fonts (headline, body with weights and transforms)
- Logo placement rules (position, clearance, minimum size)
- Typography constraints (min sizes, max headline words)

Brand rules are passed as constraints to the AI reflow engine.

---

## Getting Started

### Prerequisites

- [Figma Desktop App](https://www.figma.com/downloads/)
- [Node.js](https://nodejs.org/) v18+
- [Anthropic API Key](https://console.anthropic.com/)

### Installation

```bash
git clone https://github.com/milopraetzel/Agent-figma-creative-variations.git
cd Agent-figma-creative-variations
npm install
npm run build
```

### Configuration

Create a `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3001
```

### Run

**Start the backend:**

```bash
npm run dev:backend
```

**Load the plugin in Figma:**

1. Right-click canvas → Plugins → Development → Import plugin from manifest...
2. Select `manifest.json` from the project root
3. Right-click → Plugins → Development → Creative Variations

---

## Architecture

```
Figma Plugin (TypeScript/Preact)
    │
    │  Frame Descriptor JSON + target formats + copy variations
    ▼
Backend API (Express/Node.js)
    │
    │  Markdown memory context + brand preset + print metadata
    ▼
Claude API (Anthropic)
    │
    │  Structured reflow instructions (tool_use)
    ▼
Plugin applies instructions → new pages with variations
```

### Project Structure

```
plugin/src/
  code.ts           Plugin sandbox — orchestrates the flow
  ui.tsx            Preact UI — format browser, copy input, generate
  serializer.ts     Extracts Figma frame → JSON descriptor
  applier.ts        Applies reflow instructions → Figma frames
  types.ts          Shared type definitions

backend/src/
  server.ts         Express API server
  reflow.ts         Claude API integration
  prompt.ts         System prompt + tool schema
  context-merger.ts Merges brand/template/project markdown
  memory.ts         Markdown file CRUD
  brands.ts         Brand preset management
  template-sets.ts  Template set management

shared/
  templates.ts      43 format definitions with metadata

memory/
  brands/           Brand markdown + preset.json per brand
  templates/        Per-format layout advice
  projects/         Campaign-specific instructions
  template-sets/    Saved format groups
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reflow` | Generate reflow instructions |
| GET | `/api/health` | Health check |
| GET/PUT/DELETE | `/api/memory/:layer/:path` | Memory file CRUD |
| GET/PUT | `/api/brands/:name/preset` | Brand preset CRUD |
| GET | `/api/brands` | List brands |
| GET/PUT/DELETE | `/api/template-sets/:id` | Template set CRUD |
| GET | `/api/template-sets` | List template sets |

---

## Development

```bash
# Run tests (70 tests)
npm test

# Watch mode
npm run test:watch

# Build everything
npm run build
```

---

## Inspired by

[How Anthropic uses Claude for marketing](https://claude.com/blog/how-anthropic-uses-claude-marketing) — Austin Lau's Figma plugin that generates ad creative variations, extended here to support print formats, abstract creative handling, brand memory, and team workflows.

---

## License

MIT
