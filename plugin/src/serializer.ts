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
  if (node.visible === false) return null;

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
