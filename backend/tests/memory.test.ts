import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  listMemoryFiles, readMemoryFile, writeMemoryFile, deleteMemoryFile, setMemoryRoot,
} from "../src/memory";

const TEST_DIR = path.join(__dirname, "__test_memory__");

describe("memory CRUD", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "brands", "acme"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "templates"), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "projects"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("writes and reads a brand file", () => {
    writeMemoryFile("brands", "acme", "brand.md", "# Acme Brand\nBe bold.");
    const content = readMemoryFile("brands", "acme", "brand.md");
    expect(content).toBe("# Acme Brand\nBe bold.");
  });

  it("writes and reads a template file", () => {
    writeMemoryFile("templates", "", "instagram-story.md", "# Instagram Story\nKeep text in middle 60%.");
    const content = readMemoryFile("templates", "", "instagram-story.md");
    expect(content).toBe("# Instagram Story\nKeep text in middle 60%.");
  });

  it("writes and reads a project file", () => {
    writeMemoryFile("projects", "", "q1-launch.md", "# Q1 Launch\nUrgent tone.");
    const content = readMemoryFile("projects", "", "q1-launch.md");
    expect(content).toBe("# Q1 Launch\nUrgent tone.");
  });

  it("lists files in a layer", () => {
    writeMemoryFile("brands", "acme", "brand.md", "content");
    writeMemoryFile("brands", "acme", "voice.md", "content");
    const files = listMemoryFiles("brands", "acme");
    expect(files).toContain("brand.md");
    expect(files).toContain("voice.md");
    expect(files).toHaveLength(2);
  });

  it("lists brand directories", () => {
    writeMemoryFile("brands", "acme", "brand.md", "content");
    writeMemoryFile("brands", "nike", "brand.md", "content");
    const dirs = listMemoryFiles("brands", "");
    expect(dirs).toContain("acme");
    expect(dirs).toContain("nike");
  });

  it("deletes a file", () => {
    writeMemoryFile("brands", "acme", "brand.md", "content");
    deleteMemoryFile("brands", "acme", "brand.md");
    const content = readMemoryFile("brands", "acme", "brand.md");
    expect(content).toBeNull();
  });

  it("returns null for non-existent file", () => {
    const content = readMemoryFile("brands", "acme", "nonexistent.md");
    expect(content).toBeNull();
  });

  it("prevents path traversal", () => {
    expect(() => writeMemoryFile("brands", "../etc", "passwd", "bad")).toThrow("Invalid path");
    expect(() => readMemoryFile("brands", "acme", "../../etc/passwd")).toThrow("Invalid path");
  });
});
