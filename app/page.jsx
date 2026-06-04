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
  const inputRef   = useRef(null);
  const debounceRef = useRef(null);

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

  if (status === "loading") return (
    <div className="center-screen"><div className="spinner" /></div>
  );

  if (!session) return (
    <div className="center-screen">
      <div className="auth-card">
        <div className="auth-logo">⬡</div>
        <h1>M365<span className="accent">Search</span></h1>
        <p className="tagline">AI-powered search across OneNote, Outlook & Teams — including text inside images</p>
        <div className="source-pills">
          <span>📓 OneNote</span><span>📧 Outlook</span><span>💬 Teams</span>
        </div>
        <button className="ms-btn" onClick={() => signIn("azure-ad")}>
          <MicrosoftLogo /> Sign in with Microsoft
        </button>
      </div>
    </div>
  );

  const filteredResults = activeSource === "all"
    ? results
    : results.filter(r => r.source === activeSource);

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <span className="hlogo">⬡</span>
          <span className="hbrand">M365<span className="accent">Search</span></span>
        </div>
        <div className="header-right">
          <span className="huser">{session.user?.name}</span>
          <button className="btn-ghost" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <main>
        {/* Search input */}
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

        {/* Index controls */}
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

        {/* Index stats */}
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

        {/* Source filter tabs */}
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

        {/* Results */}
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

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',system-ui,sans-serif;background:#080810;color:#e0e0f0;min-height:100vh}

        .center-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#080810}

        .auth-card{text-align:center;padding:56px 48px;background:#101018;border:1px solid #222238;border-radius:24px;max-width:440px;width:90%}
        .auth-logo{font-size:52px;color:#6c63ff;margin-bottom:20px}
        h1{font-size:34px;font-weight:800;letter-spacing:-1.5px;color:#fff}
        .accent{color:#6c63ff}
        .tagline{margin:12px 0 24px;color:#777;font-size:15px;line-height:1.6}
        .source-pills{display:flex;gap:8px;justify-content:center;margin-bottom:28px;flex-wrap:wrap}
        .source-pills span{background:#1a1a2e;border:1px solid #2a2a45;padding:6px 14px;border-radius:20px;font-size:13px;color:#aaa}
        .ms-btn{display:inline-flex;align-items:center;gap:10px;background:#fff;color:#222;border:none;padding:13px 26px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .2s}
        .ms-btn:hover{opacity:.9}

        header{display:flex;align-items:center;justify-content:space-between;padding:16px 32px;border-bottom:1px solid #151525;background:#0c0c18;position:sticky;top:0;z-index:10}
        .header-left,.header-right{display:flex;align-items:center;gap:10px}
        .hlogo{font-size:22px;color:#6c63ff}
        .hbrand{font-size:18px;font-weight:800;letter-spacing:-0.5px;color:#fff}
        .huser{color:#666;font-size:13px}
        .btn-ghost{background:none;border:1px solid #222238;color:#666;padding:5px 12px;border-radius:6px;font-size:13px;cursor:pointer;transition:all .2s}
        .btn-ghost:hover{border-color:#6c63ff;color:#6c63ff}

        main{max-width:800px;margin:0 auto;padding:36px 24px}

        .search-row{margin-bottom:16px}
        .search-box{display:flex;align-items:center;gap:12px;background:#101018;border:1.5px solid #1e1e35;border-radius:14px;padding:14px 18px;transition:border-color .2s}
        .search-box:focus-within{border-color:#6c63ff;box-shadow:0 0 0 3px rgba(108,99,255,.12)}
        .search-input{flex:1;background:none;border:none;outline:none;color:#e0e0f0;font-size:16px;font-family:inherit}
        .search-input::placeholder{color:#3a3a55}

        .controls-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}
        .source-toggles{display:flex;gap:8px;flex-wrap:wrap}
        .toggle-btn{background:#101018;border:1px solid #1e1e35;color:#666;padding:6px 14px;border-radius:20px;font-size:13px;cursor:pointer;transition:all .2s}
        .toggle-btn.active{background:#1a1830;border-color:#6c63ff;color:#a09af0}
        .index-btn{background:#1a1830;border:1px solid #2a2a45;color:#9090cc;padding:7px 16px;border-radius:8px;font-size:13px;cursor:pointer;transition:all .2s;white-space:nowrap}
        .index-btn:hover:not(:disabled){border-color:#6c63ff;color:#6c63ff}
        .index-btn:disabled{opacity:.5;cursor:not-allowed}

        .stats-bar{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:12px;color:#555;flex-wrap:wrap;margin-bottom:8px}
        .stats-total{color:#777;font-weight:600}
        .stats-pill{background:#1a1a2e;border:1px solid #222238;padding:2px 10px;border-radius:12px;color:#666}
        .stats-time{margin-left:auto;color:#444}

        .index-msg{background:#101018;border:1px solid #1e1e35;border-radius:8px;padding:12px 16px;color:#777;font-size:14px;margin-bottom:16px}

        .source-tabs{display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid #151525;padding-bottom:0}
        .tab{background:none;border:none;color:#555;padding:10px 16px;font-size:13px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .2s;border-radius:6px 6px 0 0}
        .tab:hover{color:#9090cc}
        .tab.active{color:#a09af0;border-bottom-color:#6c63ff}
        .tab-count{background:#1a1a2e;color:#666;font-size:11px;padding:1px 6px;border-radius:10px;margin-left:6px}

        .results{display:flex;flex-direction:column;gap:10px}
        .result-card{display:block;background:#101018;border:1px solid #1a1a30;border-radius:12px;padding:16px 20px;text-decoration:none;color:inherit;transition:all .2s}
        .result-card:hover{border-color:#6c63ff;background:#12121e;transform:translateY(-1px);box-shadow:0 4px 20px rgba(108,99,255,.1)}

        .result-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        .source-badge{font-size:11px;padding:3px 9px;border-radius:4px;font-weight:600}
        .source-badge[data-source="OneNote"]{background:rgba(126,87,194,.2);color:#b39ddb}
        .source-badge[data-source="Outlook"]{background:rgba(2,136,209,.2);color:#81d4fa}
        .source-badge[data-source="Teams"]{background:rgba(94,53,177,.2);color:#ce93d8}
        .source-badge[data-source="Teams Chat"]{background:rgba(94,53,177,.2);color:#ce93d8}
        .img-badge{font-size:11px;background:rgba(108,99,255,.15);color:#9090d0;padding:3px 8px;border-radius:4px}

        .result-title{font-size:15px;font-weight:600;color:#e0e0f0;margin-bottom:3px}
        .result-title mark{background:rgba(108,99,255,.25);color:#c0b8ff;border-radius:2px;padding:0 1px}
        .result-meta{font-size:12px;color:#444;margin-bottom:8px}
        .result-snippet{font-size:13px;color:#666;line-height:1.55;margin-bottom:10px}
        .result-snippet mark{background:rgba(108,99,255,.18);color:#a0a0e0;border-radius:2px}

        .result-footer{display:flex;justify-content:space-between;font-size:11px;color:#333}
        .open-link{color:#5550a0}
        .result-card:hover .open-link{color:#9090d0}

        .empty{text-align:center;padding:60px 24px;color:#444}
        .empty-icon{font-size:36px;margin-bottom:16px;color:#222}
        .empty p{font-size:15px;margin-bottom:8px;color:#555}
        .hint{font-size:13px;color:#3a3a55}

        .spinner{width:40px;height:40px;border:3px solid #1e1e35;border-top-color:#6c63ff;border-radius:50%;animation:spin .8s linear infinite}
        .spinner-sm{width:16px;height:16px;border:2px solid #1e1e35;border-top-color:#6c63ff;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a55" strokeWidth="2.5" style={{flexShrink:0}}>
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
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
