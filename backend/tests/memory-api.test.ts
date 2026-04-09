import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot } from "../src/memory";
import { createApp } from "../src/server";

const TEST_DIR = path.join(__dirname, "__test_memory_api__");

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

describe("Memory API", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "templates"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "projects"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("PUT and GET a brand file", async () => {
    const app = createApp();
    const putRes = await request(app, "PUT", "/api/memory/brands/acme/brand.md", { content: "# Acme\nBe bold." });
    expect(putRes.status).toBe(200);
    const getRes = await request(app, "GET", "/api/memory/brands/acme/brand.md");
    expect(getRes.status).toBe(200);
    expect(getRes.body.content).toBe("# Acme\nBe bold.");
  });

  it("LIST files in a brand", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/brands/acme/brand.md", { content: "a" });
    await request(app, "PUT", "/api/memory/brands/acme/voice.md", { content: "b" });
    const listRes = await request(app, "GET", "/api/memory/brands/acme");
    expect(listRes.status).toBe(200);
    expect(listRes.body.files).toContain("brand.md");
    expect(listRes.body.files).toContain("voice.md");
  });

  it("LIST brands", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/brands/acme/brand.md", { content: "a" });
    await request(app, "PUT", "/api/memory/brands/nike/brand.md", { content: "b" });
    const listRes = await request(app, "GET", "/api/memory/brands");
    expect(listRes.status).toBe(200);
    expect(listRes.body.files).toContain("acme");
    expect(listRes.body.files).toContain("nike");
  });

  it("DELETE a file", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/brands/acme/brand.md", { content: "a" });
    const delRes = await request(app, "DELETE", "/api/memory/brands/acme/brand.md");
    expect(delRes.status).toBe(200);
    const getRes = await request(app, "GET", "/api/memory/brands/acme/brand.md");
    expect(getRes.status).toBe(404);
  });

  it("GET returns 404 for missing file", async () => {
    const app = createApp();
    const res = await request(app, "GET", "/api/memory/brands/nope/nope.md");
    expect(res.status).toBe(404);
  });

  it("PUT and GET a template file", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/templates/instagram-story.md", { content: "# Story\nMiddle 60%." });
    const res = await request(app, "GET", "/api/memory/templates/instagram-story.md");
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("Middle 60%");
  });

  it("PUT and GET a project file", async () => {
    const app = createApp();
    await request(app, "PUT", "/api/memory/projects/q1-launch.md", { content: "# Q1\nUrgent." });
    const res = await request(app, "GET", "/api/memory/projects/q1-launch.md");
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("Urgent");
  });
});
