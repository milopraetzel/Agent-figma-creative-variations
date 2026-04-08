export const REFLOW_SYSTEM_PROMPT = `You are a design layout reflow engine. You receive a JSON descriptor of a Figma frame and a target size. Your job is to generate precise layout instructions that adapt the design to the new dimensions.

Core principles:
1. RELATIONSHIPS OVER COORDINATES — encode spatial relationships as ratios, not absolute pixels
2. PRESERVE HIERARCHY — if headline is 2× body text, maintain that ratio
3. PRESERVE SPACING RHYTHM — if gaps follow a scale (4/8/16), keep the scale
4. SMART RESTRUCTURING — side-by-side layouts become stacked when aspect ratio demands it
5. MINIMUM READABILITY — never set font size below 10px

For each element, output its new position (x, y), size (width, height), rotation, and visibility.
For text elements, also output adjusted fontSize and reflowed text (lineBreaks) if the text needs to wrap differently.

If an element cannot fit in the target at readable size, set visible to false and explain in a comment.

Always call the reflow_layout tool. Never respond with plain text.`;

export const REFLOW_TOOL = {
  name: "reflow_layout" as const,
  description: "Output structured layout reflow instructions for a target format",
  input_schema: {
    type: "object" as const,
    properties: {
      targetWidth: { type: "number" as const, description: "Target frame width in pixels" },
      targetHeight: { type: "number" as const, description: "Target frame height in pixels" },
      elements: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            id: { type: "string" as const },
            x: { type: "number" as const },
            y: { type: "number" as const },
            width: { type: "number" as const },
            height: { type: "number" as const },
            rotation: { type: "number" as const },
            visible: { type: "boolean" as const },
            fontSize: { type: "number" as const, description: "Adjusted font size (text elements only)" },
            lineBreaks: { type: "string" as const, description: "Reflowed text with line breaks (text elements only)" },
          },
          required: ["id", "x", "y", "width", "height", "rotation", "visible"],
        },
      },
    },
    required: ["targetWidth", "targetHeight", "elements"],
  },
};
