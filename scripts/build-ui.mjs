#!/usr/bin/env node
/**
 * Build script for the Figma plugin UI.
 * Bundles ui.tsx with esbuild and wraps the output in an HTML file
 * with an inline <script> tag, which is what Figma expects for the `ui` field.
 */

import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Bundle ui.tsx → in-memory JS string
const result = await build({
  entryPoints: [resolve(root, "plugin/src/ui.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2020",
  jsxImportSource: "preact",
  jsx: "automatic",
});

const js = result.outputFiles[0].text;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Creative Variations</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #1e1e1e; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${js}</script>
</body>
</html>`;

writeFileSync(resolve(root, "ui.html"), html, "utf-8");
console.log("ui.html written successfully");
