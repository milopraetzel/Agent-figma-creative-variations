import Anthropic from "@anthropic-ai/sdk";
import type { FrameDescriptor, ReflowInstructions } from "./types";
import { REFLOW_SYSTEM_PROMPT, REFLOW_TOOL, buildPrintContext } from "./prompt";

const client = new Anthropic();

export async function generateReflow(
  frame: FrameDescriptor,
  targetWidth: number,
  targetHeight: number,
  markdownContext?: string,
  printMeta?: { unit: string; originalWidth: number; originalHeight: number; dpi: number; bleed?: number; safeZone?: number },
): Promise<ReflowInstructions> {
  let systemPrompt = REFLOW_SYSTEM_PROMPT;
  if (markdownContext) systemPrompt += `\n\n## Additional Context\n\n${markdownContext}`;
  if (printMeta) systemPrompt += buildPrintContext(printMeta);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: printMeta
          ? `Reflow this frame from ${frame.width}×${frame.height} to ${targetWidth}×${targetHeight} (print: ${printMeta.originalWidth}×${printMeta.originalHeight}${printMeta.unit}, ${printMeta.dpi}dpi, bleed: ${printMeta.bleed ?? 0}${printMeta.unit}, safe zone: ${printMeta.safeZone ?? 0}${printMeta.unit}).\n\nFrame descriptor:\n${JSON.stringify(frame, null, 2)}`
          : `Reflow this frame from ${frame.width}×${frame.height} to ${targetWidth}×${targetHeight}.\n\nFrame descriptor:\n${JSON.stringify(frame, null, 2)}`,
      },
    ],
    tools: [REFLOW_TOOL],
    tool_choice: { type: "tool", name: "reflow_layout" },
  });

  const toolUseBlock = response.content.find(
    (block) => block.type === "tool_use" && block.name === "reflow_layout"
  );

  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Claude did not return reflow instructions");
  }

  return toolUseBlock.input as ReflowInstructions;
}
