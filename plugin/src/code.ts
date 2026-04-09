import { serializeFrame } from "./serializer";
import { applyReflow } from "./applier";
import type { PluginMessage, UIMessage, ReflowRequest, ReflowResponse } from "./types";

const BACKEND_URL = "http://localhost:3001";

figma.showUI(__html__, { width: 400, height: 600 });

figma.on("selectionchange", () => {
  const sel = figma.currentPage.selection[0];
  if (sel && sel.type === "FRAME") {
    const textLayers = (sel as FrameNode).findAll((n) => n.type === "TEXT");
    const msg: PluginMessage = {
      type: "SELECTION_CHANGED",
      frame: {
        id: sel.id, name: sel.name, width: sel.width, height: sel.height,
        textLayerCount: textLayers.length,
      },
    };
    figma.ui.postMessage(msg);
  } else {
    figma.ui.postMessage({ type: "SELECTION_CHANGED", frame: null } as PluginMessage);
  }
});

figma.ui.on("message", async (msg: UIMessage) => {
  if (msg.type === "GENERATE") {
    try {
      const sel = figma.currentPage.selection[0];
      if (!sel || sel.type !== "FRAME") {
        figma.ui.postMessage({ type: "ERROR", message: "No frame selected" } as PluginMessage);
        return;
      }

      const frame = serializeFrame(sel);
      const totalFormats = msg.formats.length;

      for (let i = 0; i < msg.formats.length; i++) {
        const fmt = msg.formats[i];

        figma.ui.postMessage({
          type: "GENERATION_PROGRESS",
          format: fmt.name,
          step: `Reflowing (${i + 1}/${totalFormats})...`,
        } as PluginMessage);

        const memoryCtx = msg.memoryContext
          ? { ...msg.memoryContext, templateId: fmt.id }
          : undefined;

        const request: ReflowRequest = {
          frame,
          targetWidth: fmt.widthPx,
          targetHeight: fmt.heightPx,
          copyVariations: msg.copyVariations,
          printMeta: fmt.printMeta,
          memoryContext: memoryCtx,
        };

        const response = await fetch(`${BACKEND_URL}/api/reflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error ?? `Backend returned ${response.status}`);
        }

        const data: ReflowResponse = await response.json();
        await applyReflow(sel.id, fmt.name, data.variations);
      }

      figma.ui.postMessage({ type: "GENERATION_COMPLETE", pageId: "done" } as PluginMessage);
      figma.notify(`✓ Generated variations for ${totalFormats} format${totalFormats > 1 ? "s" : ""}`);
    } catch (err: any) {
      figma.ui.postMessage({ type: "ERROR", message: err.message } as PluginMessage);
      figma.notify(`✗ Error: ${err.message}`, { error: true });
    }
  }
});
