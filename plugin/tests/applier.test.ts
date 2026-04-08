import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReflowInstructions } from "../src/types";

const mockPage: any = {
  name: "",
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

const mockClonedFrame: any = {
  name: "",
  resize: vi.fn(),
  x: 0,
  y: 0,
  findAll: vi.fn(() => [{ ...mockClonedText }]),
  appendChild: vi.fn(),
};

const mockSourceFrame: any = {
  id: "frame-1",
  name: "Hero Banner",
  type: "FRAME",
  width: 1200,
  height: 630,
  findAll: vi.fn(() => [mockClonedText]),
  clone: vi.fn(() => ({
    ...mockClonedFrame,
    findAll: vi.fn(() => [{ ...mockClonedText }]),
  })),
};

vi.stubGlobal("figma", {
  createPage: vi.fn(() => ({ ...mockPage })),
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
      targetWidth: 1080, targetHeight: 1080,
      elements: [{ id: "text-1", x: 40, y: 200, width: 1000, height: 80, rotation: 0, visible: true, fontSize: 42 }],
    };
    await applyReflow("frame-1", "Instagram Post", [
      { label: "Hello World", textOverrides: { "text-1": "Hello World" }, reflow: instructions },
    ]);
    expect(figma.createPage).toHaveBeenCalled();
    expect(figma.root.appendChild).toHaveBeenCalled();
  });

  it("clones the source frame for each variation", async () => {
    const instructions: ReflowInstructions = {
      targetWidth: 1080, targetHeight: 1080, elements: [],
    };
    await applyReflow("frame-1", "Instagram Post", [
      { label: "Var A", textOverrides: {}, reflow: instructions },
      { label: "Var B", textOverrides: {}, reflow: instructions },
    ]);
    expect(mockSourceFrame.clone).toHaveBeenCalledTimes(2);
  });
});
