import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot } from "../src/memory";
import { createApp } from "../src/server";

const TEST_DIR = path.join(__dirname, "__test_brand_api__");

async function request(app: any, method: string, urlPath: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;
      fetch(`http://localhost:${port}${urlPath}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
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

describe("Brand Preset API", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "template-sets"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });
  afterEach(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });

  it("PUT and GET a brand preset", async () => {
    const app = createApp();
    const preset = { name: "Acme", colors: { primary: "#6B4EFF" }, fonts: { headline: { family: "Inter", weight: 700 }, body: { family: "Inter", weight: 400 } } };
    const putRes = await request(app, "PUT", "/api/brands/acme/preset", { preset });
    expect(putRes.status).toBe(200);
    const getRes = await request(app, "GET", "/api/brands/acme/preset");
    expect(getRes.status).toBe(200);
    expect(getRes.body.preset.name).toBe("Acme");
    expect(getRes.body.preset.colors.primary).toBe("#6B4EFF");
  });

  it("LIST brands with presets", async () => {
    const app = createApp();
    const preset = { name: "A", colors: { primary: "#000" }, fonts: { headline: { family: "A", weight: 700 }, body: { family: "A", weight: 400 } } };
    await request(app, "PUT", "/api/brands/acme/preset", { preset });
    await request(app, "PUT", "/api/brands/nike/preset", { preset: { ...preset, name: "Nike" } });
    const res = await request(app, "GET", "/api/brands");
    expect(res.status).toBe(200);
    expect(res.body.brands).toContain("acme");
    expect(res.body.brands).toContain("nike");
  });

  it("GET returns 404 for missing preset", async () => {
    const app = createApp();
    const res = await request(app, "GET", "/api/brands/nope/preset");
    expect(res.status).toBe(404);
  });
});

describe("Template Set API", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "template-sets"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });
  afterEach(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });

  it("PUT, GET, and LIST template sets", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/template-sets/q1-social", { set: { id: "q1-social", name: "Q1 Social", formatIds: ["instagram-post", "facebook-ad"] } });
    const getRes = await request(app, "GET", "/api/template-sets/q1-social");
    expect(getRes.status).toBe(200);
    expect(getRes.body.set.name).toBe("Q1 Social");
    const listRes = await request(app, "GET", "/api/template-sets");
    expect(listRes.status).toBe(200);
    expect(listRes.body.sets).toHaveLength(1);
  });

  it("DELETE a template set", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/template-sets/del-me", { set: { id: "del-me", name: "X", formatIds: [] } });
    await request(app, "DELETE", "/api/template-sets/del-me");
    const res = await request(app, "GET", "/api/template-sets/del-me");
    expect(res.status).toBe(404);
  });
});
