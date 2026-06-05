"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const SOURCES = [
  { key: "all",        label: "All",        icon: "⬡" },
  { key: "OneNote",    label: "OneNote",     icon: "📓" },
  { key: "Outlook",    label: "Outlook",     icon: "📧" },
  { key: "Teams",      label: "Teams",       icon: "💬" },
  { key: "Teams Chat", label: "Teams Chat",  icon: "💬" },
];

const INDEX_SOURCES = [
  { key: "onenote",  label: "OneNote",  icon: "📓" },
  { key: "outlook",  label: "Outlook",  icon: "📧" },
  { key: "teams",    label: "Teams",    icon: "💬" },
];

export default function Home() {
  const { data: session, status } = useSession();
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState([]);
  const [activeSource, setActiveSource] = useState("all");
  const [indexStats, setIndexStats]   = useState(null);
  const [isIndexing, setIsIndexing]   = useState(false);
  const [indexMsg, setIndexMsg]       = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSources, setSelectedSources] = useState(["onenote","outlook","teams"]);
  const [theme, setTheme] = useState("light");
  const inputRef   = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("cyth-theme") : null;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("cyth-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (session) {
      fetch("/api/index").then(r => r.json()).then(setIndexStats);
    }
  }, [session]);

  useEffect(() => {
    if (session && inputRef.current) inputRef.current.focus();
  }, [session]);

  const doSearch = useCallback(async (q, source) => {
    if (!q.trim()) { setResults([]); return; }
    setIsSearching(true);
    const sourcesParam = source === "all" ? "" : `&sources=${encodeURIComponent(source)}`;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}${sourcesParam}`);
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val, activeSource), 300);
  };

  const handleSourceTab = (src) => {
    setActiveSource(src);
    doSearch(query, src);
  };

  const handleIndex = async () => {
    setIsIndexing(true);
    setIndexMsg("Scanning your M365 content — this takes a few minutes...");
    try {
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources }),
      });
      const data = await res.json();
      setIndexMsg(data.message || "Done!");
      setIndexStats(data.stats);
    } catch {
      setIndexMsg("Indexing failed. Please try again.");
    } finally {
      setIsIndexing(false);
    }
  };

  const toggleSource = (key) => {
    setSelectedSources(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  const highlight = (text, q) => {
    if (!q || !text) return text || "";
    const terms = q.split(/\s+/).filter(Boolean);
    let result = text;
    terms.forEach(term => {
      result = result.replace(new RegExp(`(${escapeRegex(term)})`, "gi"), "<mark>$1</mark>");
    });
    return result;
  };

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const Brand = () => (
    <>
      <CythLogo />
      <span className="hbrand">Cyth <span className="accent">Search</span></span>
    </>
  );

  if (status === "loading") return (
    <div className="center-screen"><div className="spinner" /></div>
  );

  if (!session) return (
    <div className="center-screen">
      <button className="theme-toggle floating" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "light" ? "🌙" : "☀️"}
      </button>
      <div className="auth-card">
        <div className="auth-logo"><CythLogo size={52} /></div>
        <h1>Cyth <span className="accent">Search</span></h1>
        <p className="tagline">AI-powered search across OneNote, Outlook & Teams — including text inside images</p>
        <div className="source-pills">
          <span>📓 OneNote</span><span>📧 Outlook</span><span>💬 Teams</span>
        </div>
        <button className="ms-btn" onClick={() => signIn("azure-ad")}>
          <MicrosoftLogo /> Sign in with Microsoft
        </button>
      </div>
      <style>{globalStyles}</style>
    </div>
  );

  const filteredResults = activeSource === "all"
    ? results
    : results.filter(r => r.source === activeSource);

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <Brand />
        </div>
        <div className="header-right">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span className="huser">{session.user?.name}</span>
          <button className="btn-ghost" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <main>
        <div className="search-row">
          <div className="search-box">
            <SearchIcon />
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              placeholder="Search across OneNote, Outlook, and Teams..."
              value={query}
              onChange={handleQueryChange}
            />
            {isSearching && <div className="spinner-sm" />}
          </div>
        </div>

        <div className="controls-row">
          <div className="source-toggles">
            {INDEX_SOURCES.map(s => (
              <button
                key={s.key}
                className={`toggle-btn ${selectedSources.includes(s.key) ? "active" : ""}`}
                onClick={() => toggleSource(s.key)}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
          <button
            className={`index-btn ${isIndexing ? "loading" : ""}`}
            onClick={handleIndex}
            disabled={isIndexing || selectedSources.length === 0}
          >
            {isIndexing ? "Indexing..." : "↺ Re-index"}
          </button>
        </div>

        {indexStats?.total > 0 && (
          <div className="stats-bar">
            <span className="stats-total">{indexStats.total} items indexed</span>
            {Object.entries(indexStats.summary || {}).map(([src, count]) => (
              <span key={src} className="stats-pill">{count} {src}</span>
            ))}
            <span className="stats-time">
              Last indexed: {new Date(indexStats.lastIndexed).toLocaleString()}
            </span>
          </div>
        )}

        {indexMsg && <div className="index-msg">{indexMsg}</div>}

        {results.length > 0 && (
          <div className="source-tabs">
            {SOURCES.map(s => {
              const count = s.key === "all"
                ? results.length
                : results.filter(r => r.source === s.key).length;
              if (count === 0 && s.key !== "all") return null;
              return (
                <button
                  key={s.key}
                  className={`tab ${activeSource === s.key ? "active" : ""}`}
                  onClick={() => handleSourceTab(s.key)}
                >
                  {s.icon} {s.label}
                  <span className="tab-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {filteredResults.length > 0 && (
          <div className="results">
            {filteredResults.map(r => (
              <a key={r.id} href={r.webUrl} target="_blank" rel="noopener noreferrer" className="result-card">
                <div className="result-top">
                  <span className="source-badge" data-source={r.source}>
                    {r.sourceIcon} {r.source}
                  </span>
                  {r.hasImageText && <span className="img-badge">🖼 image text</span>}
                </div>
                <div className="result-title"
                  dangerouslySetInnerHTML={{ __html: highlight(r.title, query) }}
                />
                <div className="result-meta">{r.meta}</div>
                <div className="result-snippet"
                  dangerouslySetInnerHTML={{ __html: highlight(r.snippet, query) }}
                />
                <div className="result-footer">
                  <span>{r.lastModified ? new Date(r.lastModified).toLocaleDateString() : ""}</span>
                  <span className="open-link">Open →</span>
                </div>
              </a>
            ))}
          </div>
        )}

        {query && !isSearching && filteredResults.length === 0 && (
          <div className="empty">
            <div className="empty-icon">○</div>
            <p>No results for "<strong>{query}</strong>"</p>
            <p className="hint">Try different keywords or re-index to pick up recent content.</p>
          </div>
        )}

        {!query && (
          <div className="empty">
            {!indexStats?.total ? (
              <>
                <p>Select sources above and click <strong>↺ Re-index</strong> to get started.</p>
                <p className="hint">Indexing scans all your OneNote pages, Outlook emails, and Teams messages. Takes 2–5 minutes.</p>
              </>
            ) : (
              <p className="hint">Search across {indexStats.total} indexed items from OneNote, Outlook, and Teams.</p>
            )}
          </div>
        )}
      </main>

      <style>{globalStyles}</style>
    </div>
  );
}

const globalStyles = `
  :root, [data-theme="light"]{
    --bg:#ffffff; --surface:#ffffff; --surface-2:#f7f7f9; --surface-hover:#fafafc;
    --border:#e6e6ec; --border-strong:#d0d0d8;
    --text:#1a1a1f; --text-muted:#5a5a66; --text-faint:#8a8a96; --text-dim:#b0b0b8;
    --accent:#c8102e; --accent-hover:#a30d24; --accent-soft:rgba(200,16,46,.08); --accent-ring:rgba(200,16,46,.18);
    --shadow:0 4px 20px rgba(200,16,46,.08);
    --ms-btn-bg:#1a1a1f; --ms-btn-text:#ffffff;
  }
  [data-theme="dark"]{
    --bg:#080810; --surface:#101018; --surface-2:#0c0c18; --surface-hover:#12121e;
    --border:#1e1e35; --border-strong:#2a2a45;
    --text:#e0e0f0; --text-muted:#9090a0; --text-faint:#666; --text-dim:#444;
    --accent:#ff4d6d; --accent-hover:#ff6b85; --accent-soft:rgba(255,77,109,.12); --accent-ring:rgba(255,77,109,.18);
    --shadow:0 4px 20px rgba(255,77,109,.10);
    --ms-btn-bg:#ffffff; --ms-btn-text:#222;
  }

  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:var(--bg);color:var(--text)}
  body{font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;transition:background .2s,color .2s}

  .center-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);position:relative}

  .auth-card{text-align:center;padding:56px 48px;background:var(--surface);border:1px solid var(--border);border-radius:24px;max-width:440px;width:90%;box-shadow:var(--shadow)}
  .auth-logo{margin-bottom:20px;display:flex;justify-content:center}
  h1{font-size:34px;font-weight:800;letter-spacing:-1.5px;color:var(--text)}
  .accent{color:var(--accent)}
  .tagline{margin:12px 0 24px;color:var(--text-muted);font-size:15px;line-height:1.6}
  .source-pills{display:flex;gap:8px;justify-content:center;margin-bottom:28px;flex-wrap:wrap}
  .source-pills span{background:var(--surface-2);border:1px solid var(--border);padding:6px 14px;border-radius:20px;font-size:13px;color:var(--text-muted)}
  .ms-btn{display:inline-flex;align-items:center;gap:10px;background:var(--ms-btn-bg);color:var(--ms-btn-text);border:none;padding:13px 26px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .2s}
  .ms-btn:hover{opacity:.9}

  .theme-toggle{background:var(--surface-2);border:1px solid var(--border);color:var(--text-muted);width:34px;height:34px;border-radius:8px;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .2s}
  .theme-toggle:hover{border-color:var(--accent);color:var(--accent)}
  .theme-toggle.floating{position:absolute;top:20px;right:20px}

  header{display:flex;align-items:center;justify-content:space-between;padding:16px 32px;border-bottom:1px solid var(--border);background:var(--surface-2);position:sticky;top:0;z-index:10}
  .header-left,.header-right{display:flex;align-items:center;gap:10px}
  .hbrand{font-size:18px;font-weight:800;letter-spacing:-0.5px;color:var(--text)}
  .huser{color:var(--text-muted);font-size:13px}
  .btn-ghost{background:none;border:1px solid var(--border);color:var(--text-muted);padding:5px 12px;border-radius:6px;font-size:13px;cursor:pointer;transition:all .2s}
  .btn-ghost:hover{border-color:var(--accent);color:var(--accent)}

  main{max-width:800px;margin:0 auto;padding:36px 24px}

  .search-row{margin-bottom:16px}
  .search-box{display:flex;align-items:center;gap:12px;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:14px 18px;transition:border-color .2s,box-shadow .2s}
  .search-box:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-ring)}
  .search-input{flex:1;background:none;border:none;outline:none;color:var(--text);font-size:16px;font-family:inherit}
  .search-input::placeholder{color:var(--text-dim)}

  .controls-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}
  .source-toggles{display:flex;gap:8px;flex-wrap:wrap}
  .toggle-btn{background:var(--surface);border:1px solid var(--border);color:var(--text-muted);padding:6px 14px;border-radius:20px;font-size:13px;cursor:pointer;transition:all .2s}
  .toggle-btn.active{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}
  .index-btn{background:var(--accent-soft);border:1px solid var(--accent);color:var(--accent);padding:7px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
  .index-btn:hover:not(:disabled){background:var(--accent);color:#fff}
  .index-btn:disabled{opacity:.5;cursor:not-allowed}

  .stats-bar{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:12px;color:var(--text-faint);flex-wrap:wrap;margin-bottom:8px}
  .stats-total{color:var(--text-muted);font-weight:600}
  .stats-pill{background:var(--surface-2);border:1px solid var(--border);padding:2px 10px;border-radius:12px;color:var(--text-muted)}
  .stats-time{margin-left:auto;color:var(--text-dim)}

  .index-msg{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px;color:var(--text-muted);font-size:14px;margin-bottom:16px}

  .source-tabs{display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0}
  .tab{background:none;border:none;color:var(--text-faint);padding:10px 16px;font-size:13px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .2s;border-radius:6px 6px 0 0}
  .tab:hover{color:var(--accent)}
  .tab.active{color:var(--accent);border-bottom-color:var(--accent)}
  .tab-count{background:var(--surface-2);color:var(--text-muted);font-size:11px;padding:1px 6px;border-radius:10px;margin-left:6px}

  .results{display:flex;flex-direction:column;gap:10px}
  .result-card{display:block;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;text-decoration:none;color:inherit;transition:all .2s}
  .result-card:hover{border-color:var(--accent);background:var(--surface-hover);transform:translateY(-1px);box-shadow:var(--shadow)}

  .result-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .source-badge{font-size:11px;padding:3px 9px;border-radius:4px;font-weight:600;background:var(--surface-2);color:var(--text-muted)}
  .source-badge[data-source="OneNote"]{background:var(--accent-soft);color:var(--accent)}
  .source-badge[data-source="Outlook"]{background:var(--accent-soft);color:var(--accent)}
  .source-badge[data-source="Teams"]{background:var(--accent-soft);color:var(--accent)}
  .source-badge[data-source="Teams Chat"]{background:var(--accent-soft);color:var(--accent)}
  .img-badge{font-size:11px;background:var(--accent-soft);color:var(--accent);padding:3px 8px;border-radius:4px}

  .result-title{font-size:15px;font-weight:600;color:var(--text);margin-bottom:3px}
  .result-title mark{background:var(--accent-soft);color:var(--accent);border-radius:2px;padding:0 1px}
  .result-meta{font-size:12px;color:var(--text-faint);margin-bottom:8px}
  .result-snippet{font-size:13px;color:var(--text-muted);line-height:1.55;margin-bottom:10px}
  .result-snippet mark{background:var(--accent-soft);color:var(--accent);border-radius:2px}

  .result-footer{display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim)}
  .open-link{color:var(--accent)}
  .result-card:hover .open-link{color:var(--accent-hover)}

  .empty{text-align:center;padding:60px 24px;color:var(--text-faint)}
  .empty-icon{font-size:36px;margin-bottom:16px;color:var(--text-dim)}
  .empty p{font-size:15px;margin-bottom:8px;color:var(--text-muted)}
  .hint{font-size:13px;color:var(--text-dim)}

  .spinner{width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
  .spinner-sm{width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
  @keyframes spin{to{transform:rotate(360deg)}}
`;

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{flexShrink:0,color:"var(--text-dim)"}}>
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function CythLogo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{flexShrink:0}}>
      <path d="M16 2 L29 9.5 V22.5 L16 30 L3 22.5 V9.5 Z" fill="var(--accent)" />
      <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" fontFamily="Segoe UI, sans-serif">C</text>
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="1" y="1" width="8" height="8" fill="#F25022"/>
      <rect x="11" y="1" width="8" height="8" fill="#7FBA00"/>
      <rect x="1" y="11" width="8" height="8" fill="#00A4EF"/>
      <rect x="11" y="11" width="8" height="8" fill="#FFB900"/>
    </svg>
  );
}
