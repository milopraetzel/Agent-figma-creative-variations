import { readMemoryFile, listMemoryFiles } from "./memory";

export interface ContextQuery {
  brandName?: string;
  templateId?: string;
  projectName?: string;
}

export function mergeContext(query: ContextQuery): string {
  const sections: string[] = [];

  if (query.brandName) {
    const brandContent = readBrandContent(query.brandName);
    if (brandContent) {
      sections.push(`## Brand Context\n\n${brandContent}`);
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
