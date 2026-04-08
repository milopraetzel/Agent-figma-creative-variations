import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import type { PluginMessage, UIMessage } from "./types";

interface FrameInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  textLayerCount: number;
}

const FORMATS = [
  { name: "Instagram Post", width: 1080, height: 1080, category: "Digital" },
  { name: "Instagram Story", width: 1080, height: 1920, category: "Digital" },
  { name: "Facebook Ad", width: 1200, height: 628, category: "Digital" },
  { name: "LinkedIn Post", width: 1200, height: 627, category: "Digital" },
  { name: "YouTube Thumbnail", width: 1280, height: 720, category: "Digital" },
  { name: "A4 Flyer", width: 2480, height: 3508, category: "Print" },
];

function App() {
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<typeof FORMATS[0] | null>(null);
  const [copyText, setCopyText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginMessage;
      if (!msg) return;
      switch (msg.type) {
        case "SELECTION_CHANGED":
          setFrame(msg.frame);
          break;
        case "GENERATION_PROGRESS":
          setStatus(`${msg.format}: ${msg.step}`);
          break;
        case "GENERATION_COMPLETE":
          setStatus("Done!");
          setGenerating(false);
          break;
        case "ERROR":
          setStatus(`Error: ${msg.message}`);
          setGenerating(false);
          break;
      }
    };
  }, []);

  function handleGenerate() {
    if (!frame || !selectedFormat) return;
    setGenerating(true);
    setStatus("Starting...");
    const lines = copyText.split("\n").filter((l) => l.trim());
    const copyVariations: Record<string, string[]> = {};
    if (lines.length > 0) {
      copyVariations["__all__"] = lines;
    }
    const msg: UIMessage = {
      type: "GENERATE",
      targetWidth: selectedFormat.width,
      targetHeight: selectedFormat.height,
      targetName: selectedFormat.name,
      copyVariations,
    };
    parent.postMessage({ pluginMessage: msg }, "*");
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Creative Variations</span>
      </div>
      <div style={styles.section}>
        <div style={styles.label}>SOURCE FRAME</div>
        {frame ? (
          <div style={styles.frameInfo}>
            <div style={styles.frameName}>▣ "{frame.name}"</div>
            <div style={styles.frameMeta}>
              {frame.width} × {frame.height} · {frame.textLayerCount} text layers
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>Select a frame in Figma</div>
        )}
      </div>
      <div style={styles.section}>
        <div style={styles.label}>TARGET FORMAT</div>
        <div style={styles.formatList}>
          {FORMATS.map((fmt) => (
            <div
              key={fmt.name}
              style={{
                ...styles.formatItem,
                ...(selectedFormat?.name === fmt.name ? styles.formatItemSelected : {}),
              }}
              onClick={() => setSelectedFormat(fmt)}
            >
              <span>{fmt.name}</span>
              <span style={styles.formatSize}>{fmt.width}×{fmt.height}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={styles.section}>
        <div style={styles.label}>COPY VARIATIONS (one per line)</div>
        <textarea
          style={styles.textarea}
          value={copyText}
          onInput={(e) => setCopyText((e.target as HTMLTextAreaElement).value)}
          placeholder={"Think Different. Build Better.\nYour Vision, Our Platform.\nDesign Without Limits."}
          rows={4}
        />
      </div>
      <button
        style={{
          ...styles.generateButton,
          ...((!frame || !selectedFormat || generating) ? styles.generateButtonDisabled : {}),
        }}
        onClick={handleGenerate}
        disabled={!frame || !selectedFormat || generating}
      >
        {generating ? "Generating..." : `Generate ${selectedFormat ? selectedFormat.name : ""}`}
      </button>
      {status && <div style={styles.status}>{status}</div>}
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "13px",
    color: "#e0e0e0",
    background: "#1e1e1e",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid #333",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontWeight: "600", fontSize: "14px" },
  section: { padding: "12px 16px" },
  label: {
    fontSize: "11px",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: "8px",
    letterSpacing: "0.5px",
  },
  frameInfo: {
    background: "#2a2a2a",
    border: "1px dashed #555",
    borderRadius: "6px",
    padding: "12px",
    textAlign: "center",
  },
  frameName: { color: "#a78bfa" },
  frameMeta: { fontSize: "11px", color: "#666", marginTop: "4px" },
  emptyState: {
    background: "#2a2a2a",
    border: "1px dashed #444",
    borderRadius: "6px",
    padding: "24px",
    textAlign: "center",
    color: "#666",
  },
  formatList: { display: "flex", flexDirection: "column", gap: "4px" },
  formatItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  formatItemSelected: {
    background: "rgba(167, 139, 250, 0.15)",
    outline: "1px solid #a78bfa",
  },
  formatSize: { fontSize: "11px", color: "#666" },
  textarea: {
    width: "100%",
    background: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: "4px",
    padding: "8px",
    color: "#e0e0e0",
    fontSize: "12px",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },
  generateButton: {
    margin: "12px 16px",
    padding: "10px",
    background: "#a78bfa",
    color: "#1e1e1e",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    textAlign: "center",
  },
  generateButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  status: {
    padding: "8px 16px",
    fontSize: "12px",
    color: "#888",
    textAlign: "center",
  },
};

render(<App />, document.getElementById("root")!);
