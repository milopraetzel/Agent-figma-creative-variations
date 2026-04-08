import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateReflow = vi.hoisted(() => vi.fn());
vi.mock("../src/reflow", () => ({
  generateReflow: mockGenerateReflow,
}));

import { createApp } from "../src/server";
import type { ReflowRequest } from "../src/types";

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
    id: "frame-1", name: "Hero", width: 1200, height: 630,
    elements: [{
      id: "text-1", name: "Headline", type: "TEXT",
      x: 50, y: 100, width: 400, height: 60,
      relativeX: 0.042, relativeY: 0.159, relativeWidth: 0.333, relativeHeight: 0.095,
      rotation: 0, opacity: 1, visible: true,
      text: {
        characters: "Hello", fontSize: 48, fontFamily: "Inter", fontWeight: 700,
        lineHeight: 56, letterSpacing: 0, textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP", textTransform: "ORIGINAL",
      },
    }],
  },
  targetWidth: 1080, targetHeight: 1080,
  copyVariations: { "text-1": ["Hello World", "Hey There"] },
};

describe("POST /api/reflow", () => {
  beforeEach(() => { mockGenerateReflow.mockReset(); });

  it("returns reflow instructions for each variation", async () => {
    mockGenerateReflow.mockResolvedValue({
      targetWidth: 1080, targetHeight: 1080,
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
