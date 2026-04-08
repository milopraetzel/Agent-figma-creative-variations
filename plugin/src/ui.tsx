import { render } from "preact";
import { useState, useEffect, useMemo } from "preact/hooks";
import type { PluginMessage, UIMessage, FormatTemplate, PrintMeta } from "./types";
import {
  ALL_TEMPLATES, getCategories, getSubcategories, getTemplatesBySubcategory, toPx,
} from "../../shared/templates";

interface FrameInfo {
  id: string; name: string; width: number; height: number; textLayerCount: number;
}

function App() {
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Digital");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("Social Media");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyText, setCopyText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const categories = useMemo(() => getCategories(), []);
  const subcategories = useMemo(() => getSubcategories(selectedCategory), [selectedCategory]);
  const templates = useMemo(
    () => getTemplatesBySubcategory(selectedCategory, selectedSubcategory),
    [selectedCategory, selectedSubcategory],
  );

  useEffect(() => {
    if (subcategories.length > 0 && !subcategories.includes(selectedSubcategory)) {
      setSelectedSubcategory(subcategories[0]);
    }
  }, [subcategories, selectedSubcategory]);

  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginMessage;
      if (!msg) return;
      switch (msg.type) {
        case "SELECTION_CHANGED": setFrame(msg.frame); break;
        case "GENERATION_PROGRESS": setStatus(`${msg.format}: ${msg.step}`); break;
        case "GENERATION_COMPLETE": setStatus("Done!"); setGenerating(false); break;
        case "ERROR": setStatus(`Error: ${msg.message}`); setGenerating(false); break;
      }
    };
  }, []);

  function toggleFormat(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleGenerate() {
    if (!frame || selectedIds.size === 0) return;
    setGenerating(true);
    setStatus("Starting...");
    const lines = copyText.split("\n").filter((l) => l.trim());
    const copyVariations: Record<string, string[]> = {};
    if (lines.length > 0) copyVariations["__all__"] = lines;

    const formats = ALL_TEMPLATES
      .filter((t) => selectedIds.has(t.id))
      .map((t) => {
        const widthPx = toPx(t.width, t.unit, t.dpi);
        const heightPx = toPx(t.height, t.unit, t.dpi);
        const printMeta: PrintMeta | undefined = t.category === "Print"
          ? { unit: t.unit as "mm" | "in", originalWidth: t.width, originalHeight: t.height, dpi: t.dpi, bleed: t.bleed, safeZone: t.safeZone }
          : undefined;
        return { id: t.id, name: t.name, widthPx, heightPx, printMeta };
      });

    const msg: UIMessage = { type: "GENERATE", formats, copyVariations };
    parent.postMessage({ pluginMessage: msg }, "*");
  }

  function formatDimensions(t: FormatTemplate): string {
    if (t.unit === "px") return `${t.width}×${t.height}`;
    return `${t.width}×${t.height}${t.unit}`;
  }

  const selectedCount = selectedIds.size;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Creative Variations</span>
        {selectedCount > 0 && (
          <span style={styles.badge}>{selectedCount} format{selectedCount > 1 ? "s" : ""}</span>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>SOURCE FRAME</div>
        {frame ? (
          <div style={styles.frameInfo}>
            <div style={styles.frameName}>▣ "{frame.name}"</div>
            <div style={styles.frameMeta}>{frame.width} × {frame.height} · {frame.textLayerCount} text layers</div>
          </div>
        ) : (
          <div style={styles.emptyState}>Select a frame in Figma</div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>TARGET FORMATS</div>
        <div style={styles.categoryTabs}>
          {categories.map((cat) => (
            <div key={cat} style={{ ...styles.categoryTab, ...(selectedCategory === cat ? styles.categoryTabActive : {}) }}
              onClick={() => setSelectedCategory(cat)}>{cat}</div>
          ))}
        </div>
        <div style={styles.subcategoryRow}>
          {subcategories.map((sub) => (
            <div key={sub} style={{ ...styles.subcategoryPill, ...(selectedSubcategory === sub ? styles.subcategoryPillActive : {}) }}
              onClick={() => setSelectedSubcategory(sub)}>{sub}</div>
          ))}
        </div>
        <div style={styles.formatList}>
          {templates.map((t) => {
            const isSelected = selectedIds.has(t.id);
            return (
              <div key={t.id} style={{ ...styles.formatItem, ...(isSelected ? styles.formatItemSelected : {}) }}
                onClick={() => toggleFormat(t.id)}>
                <div style={styles.formatCheckbox}>
                  {isSelected
                    ? <div style={styles.checkboxChecked}>✓</div>
                    : <div style={styles.checkboxUnchecked} />}
                </div>
                <div style={styles.formatInfo}>
                  <span>{t.name}</span>
                  {t.bleed != null && t.bleed > 0 && <span style={styles.bleedBadge}>+bleed</span>}
                </div>
                <span style={styles.formatSize}>{formatDimensions(t)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>COPY VARIATIONS (one per line)</div>
        <textarea style={styles.textarea} value={copyText}
          onInput={(e) => setCopyText((e.target as HTMLTextAreaElement).value)}
          placeholder={"Think Different. Build Better.\nYour Vision, Our Platform.\nDesign Without Limits."} rows={4} />
      </div>

      <button style={{ ...styles.generateButton, ...((!frame || selectedIds.size === 0 || generating) ? styles.generateButtonDisabled : {}) }}
        onClick={handleGenerate} disabled={!frame || selectedIds.size === 0 || generating}>
        {generating ? "Generating..." : `Generate ${selectedCount} format${selectedCount !== 1 ? "s" : ""}`}
      </button>

      {status && <div style={styles.status}>{status}</div>}
    </div>
  );
}

const styles: Record<string, any> = {
  container: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: "13px", color: "#e0e0e0", background: "#1e1e1e", minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { padding: "12px 16px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontWeight: "600", fontSize: "14px" },
  badge: { background: "#a78bfa", color: "#1e1e1e", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" },
  section: { padding: "12px 16px" },
  label: { fontSize: "11px", color: "#888", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" },
  frameInfo: { background: "#2a2a2a", border: "1px dashed #555", borderRadius: "6px", padding: "12px", textAlign: "center" },
  frameName: { color: "#a78bfa" },
  frameMeta: { fontSize: "11px", color: "#666", marginTop: "4px" },
  emptyState: { background: "#2a2a2a", border: "1px dashed #444", borderRadius: "6px", padding: "24px", textAlign: "center", color: "#666" },
  categoryTabs: { display: "flex", gap: "0", marginBottom: "10px" },
  categoryTab: { padding: "6px 14px", background: "#333", fontSize: "12px", cursor: "pointer", borderRadius: "0" },
  categoryTabActive: { background: "#a78bfa", color: "#1e1e1e", fontWeight: "600" },
  subcategoryRow: { display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" },
  subcategoryPill: { padding: "3px 8px", background: "#2a2a2a", border: "1px solid #444", borderRadius: "12px", fontSize: "11px", cursor: "pointer" },
  subcategoryPillActive: { background: "rgba(167,139,250,0.2)", border: "1px solid #a78bfa", color: "#a78bfa" },
  formatList: { display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" },
  formatItem: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "4px", cursor: "pointer" },
  formatItemSelected: { background: "rgba(167,139,250,0.12)" },
  formatCheckbox: { width: "16px", height: "16px", flexShrink: 0 },
  checkboxChecked: { width: "16px", height: "16px", border: "2px solid #a78bfa", borderRadius: "3px", background: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#1e1e1e" },
  checkboxUnchecked: { width: "16px", height: "16px", border: "2px solid #444", borderRadius: "3px" },
  formatInfo: { flex: 1, display: "flex", alignItems: "center", gap: "6px" },
  bleedBadge: { fontSize: "9px", color: "#f59e0b", background: "rgba(245,158,11,0.15)", padding: "1px 4px", borderRadius: "3px" },
  formatSize: { fontSize: "11px", color: "#666" },
  textarea: { width: "100%", background: "#2a2a2a", border: "1px solid #444", borderRadius: "4px", padding: "8px", color: "#e0e0e0", fontSize: "12px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  generateButton: { margin: "12px 16px", padding: "10px", background: "#a78bfa", color: "#1e1e1e", border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "14px", cursor: "pointer", textAlign: "center" },
  generateButtonDisabled: { opacity: 0.5, cursor: "not-allowed" },
  status: { padding: "8px 16px", fontSize: "12px", color: "#888", textAlign: "center" },
};

render(<App />, document.getElementById("root")!);
