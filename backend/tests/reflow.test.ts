import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FrameDescriptor, ReflowInstructions } from "../src/types";

const mockCreate = vi.hoisted(() => vi.fn());
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
      id: "text-1", name: "Headline", type: "TEXT",
      x: 50, y: 100, width: 400, height: 60,
      relativeX: 50 / 1200, relativeY: 100 / 630,
      relativeWidth: 400 / 1200, relativeHeight: 60 / 630,
      rotation: 0, opacity: 1, visible: true,
      text: {
        characters: "Hello World", fontSize: 48, fontFamily: "Inter", fontWeight: 700,
        lineHeight: 56, letterSpacing: 0,
        textAlignHorizontal: "LEFT", textAlignVertical: "TOP", textTransform: "ORIGINAL",
      },
    },
  ],
};

describe("generateReflow", () => {
  beforeEach(() => { mockCreate.mockReset(); });

  it("calls Claude API with frame descriptor and target size", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "tool_use", name: "reflow_layout",
        input: {
          targetWidth: 1080, targetHeight: 1080,
          elements: [{ id: "text-1", x: 40, y: 200, width: 1000, height: 80, rotation: 0, visible: true, fontSize: 42 }],
        },
      }],
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
      content: [{
        type: "tool_use", name: "reflow_layout",
        input: { targetWidth: 1080, targetHeight: 1080, elements: [] },
      }],
    });
    await generateReflow(sampleFrame, 1080, 1080);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBeDefined();
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools[0].name).toBe("reflow_layout");
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "reflow_layout" });
  });
});
