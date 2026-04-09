import type { ReflowInstructions, ElementReflow, ReflowResponse } from "./types";

export async function applyReflow(
  sourceFrameId: string,
  formatName: string,
  variations: ReflowResponse["variations"],
): Promise<void> {
  const sourceFrame = await figma.getNodeByIdAsync(sourceFrameId) as FrameNode;
  if (!sourceFrame) throw new Error(`Source frame ${sourceFrameId} not found`);

  const page = figma.createPage();
  page.name = formatName;
  figma.root.appendChild(page);

  let xOffset = 0;
  const gap = 40;

  for (const variation of variations) {
    const clone = sourceFrame.clone();
    clone.name = `${formatName} / ${variation.label}`;
    clone.resize(variation.reflow.targetWidth, variation.reflow.targetHeight);

    const allNodes = clone.findAll(() => true);
    const sourceNodes = (sourceFrame as FrameNode).findAll(() => true);
    const idMap = new Map<string, SceneNode>();
    for (let i = 0; i < sourceNodes.length && i < allNodes.length; i++) {
      idMap.set(sourceNodes[i].id, allNodes[i]);
    }

    // Detach all instances so properties can be overridden
    var instances = clone.findAll(function(n) { return n.type === "INSTANCE"; });
    for (var idx = instances.length - 1; idx >= 0; idx--) {
      try { (instances[idx] as InstanceNode).detachInstance(); } catch (e) {}
    }

    // Re-query nodes after detaching
    var freshNodes = clone.findAll(function() { return true; });
    var freshSourceNodes = (sourceFrame as FrameNode).findAll(function() { return true; });
    var freshIdMap = new Map();
    for (var idx2 = 0; idx2 < freshSourceNodes.length && idx2 < freshNodes.length; idx2++) {
      freshIdMap.set(freshSourceNodes[idx2].id, freshNodes[idx2]);
    }

    for (var j = 0; j < variation.reflow.elements.length; j++) {
      var elReflow = variation.reflow.elements[j];
      var node = freshIdMap.get(elReflow.id);
      if (!node) continue;

      try {
        node.x = elReflow.x;
        node.y = elReflow.y;
        if ("resize" in node) {
          (node as any).resize(elReflow.width, elReflow.height);
        }
        node.rotation = elReflow.rotation;
      } catch (e) {}
      node.visible = elReflow.visible;

      if (node.type === "TEXT") {
        const textNode = node as TextNode;
        if (textNode.fontName !== figma.mixed) {
          await figma.loadFontAsync(textNode.fontName as FontName);
        }
        const override = variation.textOverrides[elReflow.id];
        if (override) {
          textNode.characters = elReflow.lineBreaks ?? override;
        } else if (elReflow.lineBreaks) {
          textNode.characters = elReflow.lineBreaks;
        }
        if (elReflow.fontSize != null) {
          textNode.fontSize = elReflow.fontSize;
        }
      }
    }

    clone.x = xOffset;
    clone.y = 0;
    page.appendChild(clone);
    xOffset += variation.reflow.targetWidth + gap;
  }
}
