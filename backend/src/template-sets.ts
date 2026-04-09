import * as fs from "node:fs";
import * as path from "node:path";
import { getMemoryRoot } from "./memory";
import type { TemplateSetDef } from "../../plugin/src/types";

function setsDir(): string { return path.join(getMemoryRoot(), "template-sets"); }
function setPath(id: string): string { return path.join(setsDir(), `${id}.json`); }

export function saveTemplateSet(set: TemplateSetDef): void {
  fs.mkdirSync(setsDir(), { recursive: true });
  fs.writeFileSync(setPath(set.id), JSON.stringify(set, null, 2), "utf-8");
}

export function loadTemplateSet(id: string): TemplateSetDef | null {
  try { return JSON.parse(fs.readFileSync(setPath(id), "utf-8")) as TemplateSetDef; }
  catch { return null; }
}

export function listTemplateSets(): TemplateSetDef[] {
  try {
    return fs.readdirSync(setsDir())
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(setsDir(), f), "utf-8")) as TemplateSetDef);
  } catch { return []; }
}

export function deleteTemplateSet(id: string): boolean {
  try { fs.unlinkSync(setPath(id)); return true; } catch { return false; }
}
