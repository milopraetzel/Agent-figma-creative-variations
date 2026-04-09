import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { setMemoryRoot } from "../src/memory";
import { saveTemplateSet, loadTemplateSet, listTemplateSets, deleteTemplateSet } from "../src/template-sets";
import type { TemplateSetDef } from "../../plugin/src/types";

const TEST_DIR = path.join(__dirname, "__test_tsets__");

describe("template sets", () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, "template-sets"), { recursive: true });
    setMemoryRoot(TEST_DIR);
  });
  afterEach(() => { fs.rmSync(TEST_DIR, { recursive: true, force: true }); });

  it("saves and loads a template set", () => {
    const set: TemplateSetDef = { id: "q1-social", name: "Q1 Social Campaign", formatIds: ["instagram-post", "facebook-ad", "linkedin-post"] };
    saveTemplateSet(set);
    expect(loadTemplateSet("q1-social")).toEqual(set);
  });

  it("returns null for non-existent set", () => {
    expect(loadTemplateSet("nope")).toBeNull();
  });

  it("lists all template sets", () => {
    saveTemplateSet({ id: "set-a", name: "A", formatIds: ["instagram-post"] });
    saveTemplateSet({ id: "set-b", name: "B", formatIds: ["facebook-ad"] });
    const sets = listTemplateSets();
    expect(sets).toHaveLength(2);
    expect(sets.map((s) => s.id)).toContain("set-a");
    expect(sets.map((s) => s.id)).toContain("set-b");
  });

  it("deletes a template set", () => {
    saveTemplateSet({ id: "del-me", name: "Delete Me", formatIds: [] });
    deleteTemplateSet("del-me");
    expect(loadTemplateSet("del-me")).toBeNull();
  });
});
