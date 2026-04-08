import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReflowRequest } from "../src/types";

const mockCreate = vi.hoisted(() => vi.fn());
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
  beforeEach(() => { mockCreate.mockReset(); });

  it("serialized frame → Claude reflow → structured response with variations", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "tool_use",
        name: "reflow_layout",
        input: {
          targetWidth: 1080, targetHeight: 1080,
          elements: [
            { id: "text-1", x: 40, y: 400, width: 1000, height: 100, rotation: 0, visible: true, fontSize: 42, lineBreaks: "Think Different.\nBuild Better." },
            { id: "img-1", x: 40, y: 40, width: 1000, height: 340, rotation: 0, visible: true },
          ],
        },
      }],
    });

    const request: ReflowRequest = {
      frame: {
        id: "frame-1", name: "Hero Banner", width: 1200, height: 630,
        elements: [
          {
            id: "text-1", name: "Headline", type: "TEXT",
            x: 50, y: 100, width: 500, height: 60,
            relativeX: 0.042, relativeY: 0.159, relativeWidth: 0.417, relativeHeight: 0.095,
            rotation: 0, opacity: 1, visible: true,
            text: {
              characters: "Original Headline", fontSize: 48, fontFamily: "Inter", fontWeight: 700,
              lineHeight: 56, letterSpacing: 0,
              textAlignHorizontal: "LEFT", textAlignVertical: "TOP", textTransform: "ORIGINAL",
            },
          },
          {
            id: "img-1", name: "Hero Image", type: "IMAGE",
            x: 600, y: 50, width: 550, height: 530,
            relativeX: 0.5, relativeY: 0.079, relativeWidth: 0.458, relativeHeight: 0.841,
            rotation: 0, opacity: 1, visible: true,
          },
        ],
      },
      targetWidth: 1080, targetHeight: 1080,
      copyVariations: {
        "text-1": ["Think Different. Build Better.", "Design Without Limits."],
      },
    };

    const app = createApp();
    const res = await postJSON(app, "/api/reflow", request);

    expect(res.status).toBe(200);
    expect(res.body.variations).toHaveLength(2);
    expect(res.body.variations[0].label).toBe("Think Different. Build Better.");
    expect(res.body.variations[0].textOverrides["text-1"]).toBe("Think Different. Build Better.");
    expect(res.body.variations[0].reflow.targetWidth).toBe(1080);
    expect(res.body.variations[0].reflow.elements).toHaveLength(2);
    expect(res.body.variations[1].label).toBe("Design Without Limits.");

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-5");
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "reflow_layout" });
    expect(callArgs.messages[0].content).toContain("1200×630");
    expect(callArgs.messages[0].content).toContain("1080×1080");
  });
});
