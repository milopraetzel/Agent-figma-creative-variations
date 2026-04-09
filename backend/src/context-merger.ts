import { readMemoryFile, listMemoryFiles } from "./memory";
import { loadBrandPreset, brandPresetToContext } from "./brands";

export interface ContextQuery {
  brandName?: string;
  templateId?: string;
  projectName?: string;
}

export function mergeContext(query: ContextQuery): string {
  const sections: string[] = [];

  if (query.brandName) {
    const brandParts: string[] = [];
    const mdContent = readBrandContent(query.brandName);
    if (mdContent) brandParts.push(mdContent);
    const preset = loadBrandPreset(query.brandName);
    if (preset) brandParts.push(brandPresetToContext(preset));
    if (brandParts.length > 0) {
      sections.push(`## Brand Context\n\n${brandParts.join("\n\n")}`);
    }
  }

  if (query.templateId) {
    const templateContent = readMemoryFile("templates", "", `${query.templateId}.md`);
    if (templateContent) {
      sections.push(`## Template Context\n\n${templateContent}`);
    }
  }

  if (query.projectName) {
    const projectContent = readMemoryFile("projects", "", `${query.projectName}.md`);
    if (projectContent) {
      sections.push(`## Project Context (highest priority — overrides brand and template)\n\n${projectContent}`);
    }
  }

  return sections.join("\n\n---\n\n");
}

function readBrandContent(brandName: string): string | null {
  const files = listMemoryFiles("brands", brandName).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return null;
  const contents = files
    .map((f) => readMemoryFile("brands", brandName, f))
    .filter((c): c is string => c !== null);
  return contents.length > 0 ? contents.join("\n\n") : null;
}
