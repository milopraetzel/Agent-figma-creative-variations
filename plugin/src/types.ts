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
  relativeX: number;
  relativeY: number;
  relativeWidth: number;
  relativeHeight: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  text?: TextProperties;
  fills?: FillDescriptor[];
  strokes?: StrokeDescriptor[];
  effects?: EffectDescriptor[];
  cornerRadius?: number;
  constraints?: { horizontal: string; vertical: string };
  autoLayout?: AutoLayoutDescriptor;
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
  lineBreaks?: string;
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
  bleed?: number;
  safeZone?: number;
  notes?: string;
}

export interface TemplateSet {
  id: string;
  name: string;
  formatIds: string[];
}
