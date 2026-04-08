# Creative Variations Figma Plugin — Design Spec

## Overview

A Figma plugin that generates creative variations across multiple aspect ratios and formats (digital and print) with intelligent layout reflow powered by Claude API. Built for agencies and studios with multi-brand support, team collaboration, and shareable templates.

Inspired by [Austin Lau's ad variation plugin at Anthropic](https://claude.com/blog/how-anthropic-uses-claude-marketing), extended to support print formats, abstract creative handling, brand memory, and team workflows.

## Architecture

**Plugin + Claude API Backend** — two-component system.

### Figma Plugin (Client)

- **UI Layer**: Frame selector, template browser, copy variation input, brand picker, generation progress
- **Plugin Sandbox**: Reads source frame structure, serializes to JSON descriptor, applies reflow instructions from backend, creates output pages
- **Local Storage**: Recently used templates, API key (encrypted), user preferences

### Backend API

- **Reflow Engine**: Claude API analyzes frame structure, generates layout instructions per target format
- **Template Registry**: Standard format definitions (digital + print), custom team templates
- **Brand & Team Management**: Brand presets, team sharing, permissions, usage tracking

### Data Flow

1. User selects source frame in Figma, picks target formats, pastes copy variations
2. Plugin serializes the frame (layers, positions, styles, text, images) into a Frame Descriptor JSON
3. Backend receives descriptor + target formats + copy variations + markdown context
4. Claude API analyzes design intent and generates reflow instructions per format
5. Plugin applies instructions — creates new pages, one per format, with all copy variations

## Template System

Two-level hierarchy: **Category → Platform/Use Case**.

### Digital

| Subcategory | Formats |
|---|---|
| Social Media | Instagram Post (1080×1080), Instagram Story (1080×1920), Instagram Reel Cover (1080×1920), Facebook Post (1200×630), Facebook Ad (1200×628), LinkedIn Post (1200×627), LinkedIn Banner (1584×396), X/Twitter Post (1600×900), TikTok Cover (1080×1920), Pinterest Pin (1000×1500), YouTube Thumbnail (1280×720) |
| Display Ads | Leaderboard (728×90), Medium Rectangle (300×250), Wide Skyscraper (160×600), Half Page (300×600), Large Rectangle (336×280), Billboard (970×250) |
| Video | 16:9 Landscape (1920×1080), 9:16 Portrait (1080×1920), 1:1 Square (1080×1080), 4:5 Vertical (1080×1350) |
| Email & Web | Email Header (600×200), Web Banner (1440×400), OG Image (1200×630) |

### Print

| Subcategory | Formats |
|---|---|
| DIN Standard | A3 Poster (297×420mm), A4 Flyer (210×297mm), A5 Flyer (148×210mm), A6 Postcard (105×148mm), DL Envelope (99×210mm) |
| US Standard | US Letter (8.5×11in), US Legal (8.5×14in), US Tabloid (11×17in), US Postcard (4×6in) |
| Posters & Signage | 18×24in Poster, 24×36in Poster, A1 (594×841mm), A0 (841×1189mm), Roll-Up Banner (850×2000mm) |
| Business | Business Card (85×55mm), US Business Card (3.5×2in), Letterhead (A4/US Letter), Compliment Slip (DL) |
| Packaging | Label (custom), Box wrap (custom) |

### Template Features

- Print templates include 3mm bleed + safe zone guides
- Print uses CMYK-aware export with color profile warnings
- Custom templates — teams add own formats with dimensions, bleed, safe zones
- Template sets — save a group of formats as a preset (e.g., "Q1 Campaign" = Instagram + Facebook + A4 Flyer)
- Orientation toggle — portrait/landscape for any format

## Plugin UI

Three-step workflow inside Figma's dark UI.

### Step 1 — Select Source & Formats

- Source frame selector shows frame name, dimensions, layer count
- Format picker with Digital/Print category tabs
- Subcategory pills (Social, Display, Video, Email)
- Checkbox list of formats with aspect ratio thumbnails
- Save/load template sets
- Brand selector in top bar

### Step 2 — Paste Copy Variations

- Plugin auto-detects text layers from selected frame
- Per-layer paste area — one variation per line
- Layers with no pasted variations keep original text
- Live permutation counter: "3 headlines × 2 subheadlines × 2 formats = 12 creatives"

### Step 3 — Generate

- Single generate button with estimated time
- Progress indicator per format
- Output: new page per aspect ratio, containing all copy variations

## Reflow Engine

### Pipeline

1. **Serialize** — Plugin extracts layer tree, positions, sizes, constraints, text content, styles, fonts, fills, effects, opacity, auto-layout settings → Frame Descriptor JSON
2. **Analyze** — Claude API identifies semantic roles (headline, body, CTA, hero image, logo, background), visual hierarchy, layout pattern (centered, split, grid, overlay), anchor points
3. **Reflow** — For each target format: new positions/sizes, font size adjustments, layout restructuring, image crop/fit, print bleed/safe zones
4. **Apply** — Plugin creates pages, clones frame structure, applies changes, swaps text per variation

### Design Characteristics Captured

**Spatial Properties**
- Outer margins and inner padding as percentage ratios (not absolute pixels)
- Gap detection between sibling elements
- Spacing rhythm detection (e.g., 4/8/16/32px scale)
- Alignment axes, relative positions, z-index, anchor points
- Asymmetric margins preserved

**Typography**
- Font family, weight, style per layer
- Size ratios between text layers preserved (if headline is 2× body, stays 2×)
- Line height (relative), letter spacing, text transform
- Minimum readable size enforced (10px digital / 6pt print)
- Text bounding box vs available space measurement
- Natural word-boundary line breaks, widow/orphan prevention
- Multi-language awareness (German compound words, CJK)

**Visual Properties**
- Solid fills, gradients (angle preserved relative to intent)
- Opacity, blend modes, background patterns
- Drop shadows, inner shadows, blur, border radius, strokes
- Image fill mode, focal point detection for smart cropping
- SVG/vector preservation, aspect ratio lock

### Core Principle: Relationships Over Coordinates

Everything is encoded as relative relationships, not absolute pixels:
- "Headline is centered horizontally, 15% from top"
- "CTA anchored 10% from bottom-right"
- "Image overlaps text by 20% of its height"
- "White space ratio between groups is 1 : 1.5 : 1"

### Abstract Creative Handling

| Type | Strategy |
|---|---|
| Overlapping / Layered | Spatial relationships preserved, not x/y. Overlap ratios and z-order maintained. |
| Geometric / Decorative | Classified as compositional — scale proportionally. Rotation angles preserved. Patterns tile to new dimensions. |
| Full-Bleed / Minimal Type | Image stays full-bleed, focal point preserved. Text maintains relative position (e.g., "bottom-left, 8% from edge"). |
| Asymmetric / Broken Grid | Intentional asymmetry detected. Offset ratios preserved — 30% off-center stays 30% off-center. |
| Type-as-Art | Detects text functioning as graphic vs readable. Graphic text scales like an image. Readable text follows typography rules. |
| Multi-Frame / Sequential | Panel structure detected, reading sequence preserved. Panels may reflow horizontal → vertical in portrait. |

### Smart Reflow Rules

- Landscape → Square: side-by-side becomes stacked, image moves on top
- Landscape → Portrait: full restructure, image expands, text centers below
- Any → Narrow (display ads): elements stack vertically, fonts reduce, CTA stays prominent
- Any → Print: 300 DPI, bleed margins, safe zones, font sizes in pt
- Long text: font size adjusted, line breaks added, or flagged for truncation

### Edge Cases Flagged for Review

- Extreme ratio changes (e.g., 728×90 → 160×600)
- Text overflow at minimum font size
- Complex masks, clip paths, boolean operations

## Markdown Memory System

Three layers of markdown files merged into a single context before each generation.

### Layer 1 — Brand (`brands/<brand-name>/brand.md`)

Applies to all creatives for this brand. Contains: voice & tone, visual identity rules, color palette, logo placement, typography hierarchy, forbidden patterns.

### Layer 2 — Template (`templates/<format-name>.md`)

Applies to all creatives using this format. Contains: safe zones, platform quirks, layout advice, best practices, text placement rules, platform-specific notes.

### Layer 3 — Project (`projects/<project-name>.md`)

Applies to this campaign only. Contains: campaign goals, art direction, tone overrides, specific imagery instructions, asset references.

### Conflict Resolution

- Most specific wins: Project overrides Template overrides Brand
- Most rules are additive (stack naturally)
- Engine logs which rules were applied and where overrides occurred
- Transparency: generation log shows applied rules and conflicts

### Management

- Browse & edit in plugin UI with markdown editor + preview
- Plain markdown files — editable in any editor, version-controllable
- Shareable via team sync (backend)
- Learning: plugin suggests markdown additions after repeated manual adjustments

## Brand & Team Management

### Brand Presets

- Multiple brands per workspace, switchable in plugin UI
- Per-brand: fonts, colors, logo placement rules, typography constraints, safe zones
- Brand rules passed to Claude API as constraints on reflow
- Brand presets are optional — plugin works without them

### Team Roles

| Role | Permissions |
|---|---|
| Admin | Create/edit brands, manage templates, invite members, manage API keys |
| Designer | Use all brands, create personal template sets, edit project markdown |
| Viewer | Generate creatives with existing presets only |

### API Key Management

- Team-level API key (shared, usage tracked per member)
- Personal API key (BYOK)
- Usage dashboard: generations per member, cost tracking

### Shareable Assets

- Brand presets synced across team
- Template sets (e.g., "Q1 Campaign Formats")
- Custom format definitions
- Markdown memory files

## Tech Stack

- **Plugin**: TypeScript, Figma Plugin API, HTML/CSS UI
- **Backend**: Node.js API server
- **AI**: Claude API (Anthropic) for reflow intelligence
- **Storage**: Backend database for brands, teams, templates, markdown files
- **Auth**: API key based (team or personal)

## Output

- One new Figma page per target format
- Each page contains all copy variation permutations
- Frames named: `{format} / {variation}` (e.g., "Instagram Post / Headline 1 + Sub 1")
- Print pages include bleed guides and safe zone overlays
- Generation log available showing applied rules, overrides, and flags
