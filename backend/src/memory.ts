import * as fs from "node:fs";
import * as path from "node:path";

let memoryRoot = path.join(process.cwd(), "memory");

export function setMemoryRoot(root: string): void {
  memoryRoot = root;
}

export function getMemoryRoot(): string {
  return memoryRoot;
}

type Layer = "brands" | "templates" | "projects";

function validatePath(layer: Layer, subdir: string, filename: string): string {
  if (subdir.includes("..") || filename.includes("..")) {
    throw new Error("Invalid path: path traversal not allowed");
  }
  const parts = [memoryRoot, layer];
  if (subdir) parts.push(subdir);
  if (filename) parts.push(filename);
  const resolved = path.resolve(path.join(...parts));
  if (!resolved.startsWith(path.resolve(memoryRoot))) {
    throw new Error("Invalid path: outside memory root");
  }
  return resolved;
}

export function writeMemoryFile(layer: Layer, subdir: string, filename: string, content: string): void {
  const filePath = validatePath(layer, subdir, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

export function readMemoryFile(layer: Layer, subdir: string, filename: string): string | null {
  const filePath = validatePath(layer, subdir, filename);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function listMemoryFiles(layer: Layer, subdir: string): string[] {
  const dirPath = validatePath(layer, subdir, "");
  try {
    return fs.readdirSync(dirPath).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
}

export function deleteMemoryFile(layer: Layer, subdir: string, filename: string): boolean {
  const filePath = validatePath(layer, subdir, filename);
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
