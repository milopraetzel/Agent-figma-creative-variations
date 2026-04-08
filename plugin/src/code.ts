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
        id: sel.id,
        name: sel.name,
        width: sel.width,
        height: sel.height,
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

      figma.ui.postMessage({
        type: "GENERATION_PROGRESS",
        format: msg.targetName,
        step: "Serializing frame...",
      } as PluginMessage);

      const frame = serializeFrame(sel);

      figma.ui.postMessage({
        type: "GENERATION_PROGRESS",
        format: msg.targetName,
        step: "Sending to reflow engine...",
      } as PluginMessage);

      const request: ReflowRequest = {
        frame,
        targetWidth: msg.targetWidth,
        targetHeight: msg.targetHeight,
        copyVariations: msg.copyVariations,
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

      figma.ui.postMessage({
        type: "GENERATION_PROGRESS",
        format: msg.targetName,
        step: "Applying reflow...",
      } as PluginMessage);

      await applyReflow(sel.id, msg.targetName, data.variations);

      figma.ui.postMessage({
        type: "GENERATION_COMPLETE",
        pageId: "done",
      } as PluginMessage);

      figma.notify(`✓ Generated ${data.variations.length} variations for ${msg.targetName}`);
    } catch (err: any) {
      figma.ui.postMessage({ type: "ERROR", message: err.message } as PluginMessage);
      figma.notify(`✗ Error: ${err.message}`, { error: true });
    }
  }
});
