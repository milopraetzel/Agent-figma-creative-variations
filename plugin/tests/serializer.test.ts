import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FrameDescriptor } from "../src/types";

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
