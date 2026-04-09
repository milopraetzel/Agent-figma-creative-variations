import { render } from "preact";
import { useState, useEffect, useMemo } from "preact/hooks";
import type { PluginMessage, UIMessage, FormatTemplate, PrintMeta, MemoryContext } from "./types";
import {
  ALL_TEMPLATES, getCategories, getSubcategories, getTemplatesBySubcategory, toPx,
} from "../../shared/templates";

interface FrameInfo {
  id: string; name: string; width: number; height: number; textLayerCount: number;
}

const API = "http://localhost:3001";

function App() {
  const [tab, setTab] = useState<"generate" | "memory">("generate");
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Digital");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("Social Media");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyText, setCopyText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [templateSets, setTemplateSets] = useState<Array<{ id: string; name: string; formatIds: string[] }>>([]);

  // Memory editor state
  const [memoryTab, setMemoryTab] = useState<"brands" | "projects">("brands");
  const [editingFile, setEditingFile] = useState<{ layer: string; subdir: string; filename: string } | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = useMemo(function() { return getCategories(); }, []);
  const subcategories = useMemo(function() { return getSubcategories(selectedCategory); }, [selectedCategory]);
  const templates = useMemo(
    function() { return getTemplatesBySubcategory(selectedCategory, selectedSubcategory); },
    [selectedCategory, selectedSubcategory],
  );

  useEffect(function() {
    if (subcategories.length > 0 && !subcategories.includes(selectedSubcategory)) {
      setSelectedSubcategory(subcategories[0]);
    }
  }, [subcategories, selectedSubcategory]);

  useEffect(function() {
    refreshMemoryLists();
  }, []);

  function refreshMemoryLists() {
    fetch(API + "/api/memory/brands")
      .then(function(r) { return r.json(); })
      .then(function(d) { setBrands(d.files || []); })
      .catch(function() {});
    fetch(API + "/api/memory/projects")
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var files = d.files || [];
        setProjects(files.filter(function(f) { return f.endsWith(".md"); }).map(function(f) { return f.replace(".md", ""); }));
      })
      .catch(function() {});
    fetch(API + "/api/template-sets")
      .then(function(r) { return r.json(); })
      .then(function(d) { setTemplateSets(d.sets || []); })
      .catch(function() {});
  }

  useEffect(function() {
    window.onmessage = function(event) {
      var msg = event.data.pluginMessage;
      if (!msg) return;
      switch (msg.type) {
        case "SELECTION_CHANGED": setFrame(msg.frame); break;
        case "GENERATION_PROGRESS": setStatus(msg.format + ": " + msg.step); break;
        case "GENERATION_COMPLETE": setStatus("Done!"); setGenerating(false); break;
        case "ERROR": setStatus("Error: " + msg.message); setGenerating(false); break;
      }
    };
  }, []);

  function toggleFormat(id) {
    setSelectedIds(function(prev) {
      var next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleGenerate() {
    if (!frame || selectedIds.size === 0) return;
    setGenerating(true);
    setStatus("Starting...");
    var lines = copyText.split("\n").filter(function(l) { return l.trim(); });
    var copyVariations = {};
    if (lines.length > 0) copyVariations["__all__"] = lines;

    var formats = ALL_TEMPLATES
      .filter(function(t) { return selectedIds.has(t.id); })
      .map(function(t) {
        var widthPx = toPx(t.width, t.unit, t.dpi);
        var heightPx = toPx(t.height, t.unit, t.dpi);
        var printMeta = t.category === "Print"
          ? { unit: t.unit, originalWidth: t.width, originalHeight: t.height, dpi: t.dpi, bleed: t.bleed, safeZone: t.safeZone }
          : undefined;
        return { id: t.id, name: t.name, widthPx: widthPx, heightPx: heightPx, printMeta: printMeta };
      });

    var memoryContext = {};
    if (selectedBrand) memoryContext.brandName = selectedBrand;
    if (selectedProject) memoryContext.projectName = selectedProject;

    var msg = {
      type: "GENERATE",
      formats: formats,
      copyVariations: copyVariations,
      memoryContext: Object.keys(memoryContext).length > 0 ? memoryContext : undefined,
    };
    parent.postMessage({ pluginMessage: msg }, "*");
  }

  function formatDimensions(t) {
    if (t.unit === "px") return t.width + "\u00D7" + t.height;
    return t.width + "\u00D7" + t.height + t.unit;
  }

  // Memory editor functions
  function openEditor(layer, subdir, filename) {
    setEditingFile({ layer: layer, subdir: subdir, filename: filename });
    var url = API + "/api/memory/" + layer;
    if (subdir) url += "/" + subdir;
    url += "/" + filename;
    fetch(url)
      .then(function(r) { return r.ok ? r.json() : { content: "" }; })
      .then(function(d) { setEditorContent(d.content || ""); })
      .catch(function() { setEditorContent(""); });
  }

  function saveEditor() {
    if (!editingFile) return;
    setSaving(true);
    var url = API + "/api/memory/" + editingFile.layer;
    if (editingFile.subdir) url += "/" + editingFile.subdir;
    url += "/" + editingFile.filename;
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editorContent }),
    })
      .then(function() {
        setSaving(false);
        setEditingFile(null);
        refreshMemoryLists();
      })
      .catch(function() { setSaving(false); });
  }

  function createNewBrand() {
    var name = prompt("Brand name:");
    if (!name) return;
    var slug = name.toLowerCase().replace(/\s+/g, "-");
    openEditor("brands", slug, "brand.md");
    setEditorContent("# " + name + " Brand Guidelines\n\n## Voice & Tone\n- \n\n## Visual Identity\n- Primary color: \n\n## Typography\n- Headlines: \n- Body: \n\n## Rules\n- ");
  }

  function createNewProject() {
    var name = prompt("Project name:");
    if (!name) return;
    var slug = name.toLowerCase().replace(/\s+/g, "-");
    openEditor("projects", "", slug + ".md");
    setEditorContent("# " + name + "\n\n## Campaign Goal\n\n\n## Art Direction\n- \n\n## Tone\n- \n\n## Specific Instructions\n- ");
  }

  function deleteMemoryItem(layer, subdir, filename) {
    var url = API + "/api/memory/" + layer;
    if (subdir) url += "/" + subdir;
    url += "/" + filename;
    fetch(url, { method: "DELETE" })
      .then(function() { refreshMemoryLists(); });
  }

  var selectedCount = selectedIds.size;

  // Editor overlay
  if (editingFile) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>
            {editingFile.subdir ? editingFile.subdir + "/" : ""}{editingFile.filename}
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={styles.headerBtn} onClick={function() { setEditingFile(null); }}>Cancel</div>
            <div style={{ ...styles.headerBtn, ...styles.headerBtnPrimary }} onClick={saveEditor}>
              {saving ? "Saving..." : "Save"}
            </div>
          </div>
        </div>
        <textarea
          style={styles.editorTextarea}
          value={editorContent}
          onInput={function(e) { setEditorContent(e.target.value); }}
          placeholder="Write your markdown guidelines here..."
        />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header with tabs */}
      <div style={styles.header}>
        <span style={styles.title}>Creative Variations</span>
        <div style={styles.tabRow}>
          <div style={{ ...styles.tabBtn, ...(tab === "generate" ? styles.tabBtnActive : {}) }}
            onClick={function() { setTab("generate"); }}>Generate</div>
          <div style={{ ...styles.tabBtn, ...(tab === "memory" ? styles.tabBtnActive : {}) }}
            onClick={function() { setTab("memory"); }}>Memory</div>
        </div>
      </div>

      {tab === "generate" ? (
        <div>
          {/* Source frame */}
          <div style={styles.section}>
            <div style={styles.label}>SOURCE FRAME</div>
            {frame ? (
              <div style={styles.frameInfo}>
                <div style={styles.frameName}>{"▣ \"" + frame.name + "\""}</div>
                <div style={styles.frameMeta}>{frame.width} × {frame.height} · {frame.textLayerCount} text layers</div>
              </div>
            ) : (
              <div style={styles.emptyState}>Select a frame in Figma</div>
            )}
          </div>

          {/* Formats */}
          <div style={styles.section}>
            <div style={styles.label}>TARGET FORMATS</div>
            <div style={styles.categoryTabs}>
              {categories.map(function(cat) {
                return <div key={cat} style={{ ...styles.categoryTab, ...(selectedCategory === cat ? styles.categoryTabActive : {}) }}
                  onClick={function() { setSelectedCategory(cat); }}>{cat}</div>;
              })}
            </div>
            <div style={styles.subcategoryRow}>
              {subcategories.map(function(sub) {
                return <div key={sub} style={{ ...styles.subcategoryPill, ...(selectedSubcategory === sub ? styles.subcategoryPillActive : {}) }}
                  onClick={function() { setSelectedSubcategory(sub); }}>{sub}</div>;
              })}
            </div>
            <div style={styles.formatList}>
              {templates.map(function(t) {
                var isSelected = selectedIds.has(t.id);
                return (
                  <div key={t.id} style={{ ...styles.formatItem, ...(isSelected ? styles.formatItemSelected : {}) }}
                    onClick={function() { toggleFormat(t.id); }}>
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
            {/* Template sets */}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              {templateSets.map(function(ts) {
                return <div key={ts.id} style={styles.subcategoryPill}
                  onClick={function() { setSelectedIds(new Set(ts.formatIds)); }}>{ts.name}</div>;
              })}
              {selectedIds.size > 0 && (
                <div style={{ ...styles.subcategoryPill, color: "#10b981", borderColor: "#10b981" }}
                  onClick={function() {
                    var name = prompt("Template set name:");
                    if (!name) return;
                    var id = name.toLowerCase().replace(/\s+/g, "-");
                    var set = { id: id, name: name, formatIds: Array.from(selectedIds) };
                    fetch(API + "/api/template-sets/" + id, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ set: set }),
                    }).then(function() { setTemplateSets(function(prev) { return prev.concat([set]); }); });
                  }}>
                  + Save set
                </div>
              )}
            </div>
          </div>

          {/* Copy variations */}
          <div style={styles.section}>
            <div style={styles.label}>COPY VARIATIONS (one per line)</div>
            <textarea style={styles.textarea} value={copyText}
              onInput={function(e) { setCopyText(e.target.value); }}
              placeholder={"Think Different. Build Better.\nYour Vision, Our Platform.\nDesign Without Limits."} rows={4} />
          </div>

          {/* Memory context selectors */}
          {(brands.length > 0 || projects.length > 0) && (
            <div style={styles.section}>
              <div style={styles.label}>MEMORY CONTEXT</div>
              {brands.length > 0 && (
                <div style={{ marginBottom: "8px" }}>
                  <select style={styles.select} value={selectedBrand}
                    onChange={function(e) { setSelectedBrand(e.target.value); }}>
                    <option value="">No brand</option>
                    {brands.map(function(b) { return <option key={b} value={b}>{b}</option>; })}
                  </select>
                </div>
              )}
              {projects.length > 0 && (
                <div>
                  <select style={styles.select} value={selectedProject}
                    onChange={function(e) { setSelectedProject(e.target.value); }}>
                    <option value="">No project</option>
                    {projects.map(function(p) { return <option key={p} value={p}>{p}</option>; })}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Generate */}
          <button style={{ ...styles.generateButton, ...((!frame || selectedIds.size === 0 || generating) ? styles.generateButtonDisabled : {}) }}
            onClick={handleGenerate} disabled={!frame || selectedIds.size === 0 || generating}>
            {generating ? "Generating..." : "Generate " + selectedCount + " format" + (selectedCount !== 1 ? "s" : "")}
          </button>

          {status && <div style={styles.status}>{status}</div>}
        </div>
      ) : (
        /* Memory Tab */
        <div>
          <div style={styles.section}>
            <div style={styles.memoryTabs}>
              <div style={{ ...styles.memoryTab, ...(memoryTab === "brands" ? styles.memoryTabActive : {}) }}
                onClick={function() { setMemoryTab("brands"); }}>Brands</div>
              <div style={{ ...styles.memoryTab, ...(memoryTab === "projects" ? styles.memoryTabActive : {}) }}
                onClick={function() { setMemoryTab("projects"); }}>Projects</div>
            </div>
          </div>

          {memoryTab === "brands" && (
            <div style={styles.section}>
              <div style={styles.memoryList}>
                {brands.map(function(brand) {
                  return (
                    <div key={brand} style={styles.memoryItem}>
                      <div style={styles.memoryItemName}>{brand}</div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <div style={styles.memoryAction}
                          onClick={function() { openEditor("brands", brand, "brand.md"); }}>Edit</div>
                        <div style={{ ...styles.memoryAction, color: "#ef4444" }}
                          onClick={function() { deleteMemoryItem("brands", brand, "brand.md"); }}>Delete</div>
                      </div>
                    </div>
                  );
                })}
                {brands.length === 0 && (
                  <div style={styles.emptyState}>No brands yet</div>
                )}
              </div>
              <div style={styles.addButton} onClick={createNewBrand}>+ New Brand</div>
            </div>
          )}

          {memoryTab === "projects" && (
            <div style={styles.section}>
              <div style={styles.memoryList}>
                {projects.map(function(project) {
                  return (
                    <div key={project} style={styles.memoryItem}>
                      <div style={styles.memoryItemName}>{project}</div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <div style={styles.memoryAction}
                          onClick={function() { openEditor("projects", "", project + ".md"); }}>Edit</div>
                        <div style={{ ...styles.memoryAction, color: "#ef4444" }}
                          onClick={function() { deleteMemoryItem("projects", "", project + ".md"); }}>Delete</div>
                      </div>
                    </div>
                  );
                })}
                {projects.length === 0 && (
                  <div style={styles.emptyState}>No projects yet</div>
                )}
              </div>
              <div style={styles.addButton} onClick={createNewProject}>+ New Project</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

var styles = {
  container: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: "13px", color: "#e0e0e0", background: "#1e1e1e", minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { padding: "12px 16px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontWeight: "600", fontSize: "14px" },
  badge: { background: "#a78bfa", color: "#1e1e1e", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" },
  tabRow: { display: "flex", gap: "2px" },
  tabBtn: { padding: "4px 10px", fontSize: "11px", borderRadius: "4px", cursor: "pointer", color: "#888" },
  tabBtnActive: { background: "#a78bfa", color: "#1e1e1e", fontWeight: "600" },
  headerBtn: { padding: "4px 10px", fontSize: "11px", borderRadius: "4px", cursor: "pointer", color: "#888", border: "1px solid #444" },
  headerBtnPrimary: { background: "#a78bfa", color: "#1e1e1e", fontWeight: "600", border: "none" },
  section: { padding: "12px 16px" },
  label: { fontSize: "11px", color: "#888", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" },
  frameInfo: { background: "#2a2a2a", border: "1px dashed #555", borderRadius: "6px", padding: "12px", textAlign: "center" },
  frameName: { color: "#a78bfa" },
  frameMeta: { fontSize: "11px", color: "#666", marginTop: "4px" },
  emptyState: { background: "#2a2a2a", border: "1px dashed #444", borderRadius: "6px", padding: "24px", textAlign: "center", color: "#666", fontSize: "12px" },
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
  select: { width: "100%", background: "#2a2a2a", border: "1px solid #444", borderRadius: "4px", padding: "6px 8px", color: "#e0e0e0", fontSize: "12px", fontFamily: "inherit" },
  generateButton: { margin: "12px 16px", padding: "10px", background: "#a78bfa", color: "#1e1e1e", border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "14px", cursor: "pointer", textAlign: "center" },
  generateButtonDisabled: { opacity: 0.5, cursor: "not-allowed" },
  status: { padding: "8px 16px", fontSize: "12px", color: "#888", textAlign: "center" },
  // Memory tab styles
  memoryTabs: { display: "flex", gap: "0", marginBottom: "4px" },
  memoryTab: { padding: "6px 14px", background: "#2a2a2a", fontSize: "12px", cursor: "pointer", flex: 1, textAlign: "center" },
  memoryTabActive: { background: "#333", color: "#a78bfa", fontWeight: "600" },
  memoryList: { display: "flex", flexDirection: "column", gap: "4px" },
  memoryItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#2a2a2a", borderRadius: "4px" },
  memoryItemName: { fontWeight: "500" },
  memoryAction: { fontSize: "11px", color: "#a78bfa", cursor: "pointer" },
  addButton: { marginTop: "8px", padding: "8px", background: "#2a2a2a", border: "1px dashed #444", borderRadius: "6px", textAlign: "center", cursor: "pointer", color: "#10b981", fontSize: "12px" },
  editorTextarea: { width: "100%", flex: 1, background: "#2a2a2a", border: "none", padding: "16px", color: "#e0e0e0", fontSize: "12px", fontFamily: "'SF Mono', Monaco, Consolas, monospace", lineHeight: "1.6", resize: "none", boxSizing: "border-box", minHeight: "calc(100vh - 50px)" },
};

render(<App />, document.getElementById("root")!);
