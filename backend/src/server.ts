import express from "express";
import cors from "cors";
import { generateReflow } from "./reflow";
import { mergeContext } from "./context-merger";
import type { ReflowRequest, ReflowResponse } from "./types";

export function createApp(): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.post("/api/reflow", async (req, res) => {
    const body = req.body as Partial<ReflowRequest>;

    if (!body.frame || !body.targetWidth || !body.targetHeight) {
      res.status(400).json({ error: "Missing required fields: frame, targetWidth, targetHeight" });
      return;
    }

    const { frame, targetWidth, targetHeight, copyVariations } = body as ReflowRequest;

    const markdownContext = body.memoryContext
      ? mergeContext(body.memoryContext)
      : undefined;

    try {
      const variationEntries = Object.entries(copyVariations ?? {});

      if (variationEntries.length === 0) {
        const reflow = await generateReflow(frame, targetWidth, targetHeight, markdownContext, body.printMeta);
        const response: ReflowResponse = {
          variations: [{ label: "Original", textOverrides: {}, reflow }],
        };
        res.json(response);
        return;
      }

      const permutations = generatePermutations(variationEntries);
      const reflow = await generateReflow(frame, targetWidth, targetHeight, markdownContext, body.printMeta);

      const response: ReflowResponse = {
        variations: permutations.map((perm) => ({
          label: Object.values(perm)[0] ?? "Variation",
          textOverrides: perm,
          reflow,
        })),
      };

      res.json(response);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Internal server error" });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

function generatePermutations(entries: [string, string[]][]): Record<string, string>[] {
  if (entries.length === 0) return [{}];
  const [id, values] = entries[0];
  const rest = generatePermutations(entries.slice(1));
  return values.flatMap((value) =>
    rest.map((perm) => ({ [id]: value, ...perm }))
  );
}

const port = process.env.PORT ?? 3001;
if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  app.listen(port, () => {
    console.log(`Creative Variations backend running on http://localhost:${port}`);
  });
}
