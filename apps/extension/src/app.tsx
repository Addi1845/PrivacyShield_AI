import { clearMeanings } from "./semantic-cache";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  EyeOff,
  FileText,
  Image as ImageIcon,
  LockKeyhole,
  MonitorUp,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  sanitize,
  sample,
  validateOutput,
  type Result,
} from "../../../packages/privacy-core";
import { AskPrivately } from "./ask-privately";
import { MeetingGuide } from "./meeting-guide";
import { Screenshot } from "./screenshot";
import {
  isExtension,
  selection,
  currentTab,
  readSettings,
  saveSettings,
  countScan,
  pageText,
  modeStatus,
  enableMode,
  disableMode,
} from "./runtime";
import { openMeetingView } from "./sharing";
import "./styles.css";

type Tool = "ask" | "present" | "sanitize" | "settings";
type SourceScope = "selection" | "visible" | "paste";
const tools: { id: Tool; label: string; description: string }[] = [
  { id: "ask", label: "Ask privately", description: "Choose what AI can know" },
  {
    id: "present",
    label: "Present safely",
    description: "Protect a shared tab",
  },
  { id: "sanitize", label: "Sanitize", description: "Clean text or images" },
  { id: "settings", label: "Settings", description: "Privacy preferences" },
];
const pageTitles: Record<Tool, [string, string, string]> = {
  ask: [
    "AI CONTEXT FIREWALL",
    "Your task. Your context. Your boundary.",
    "Give your chosen AI the useful part of a webpage. Keep unrelated account details and browsing context out of the handoff.",
  ],
  present: [
    "PRIVACY SCREEN",
    "Present the work. Keep the rest private.",
    "Mask supported information on a browser tab or create a reviewed, clean meeting view.",
  ],
  sanitize: [
    "SANITIZATION STUDIO",
    "Clean content before it travels.",
    "Prepare text and screenshots for a chat, document, ticket, or meeting.",
  ],
  settings: [
    "PRIVACY POLICY",
    "Your boundaries, set once.",
    "Control local protection and optional AI processing permissions.",
  ],
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="brand-name">
        PrivacyShield<small>CONTEXT FIREWALL</small>
      </span>
    </div>
  );
}
function TrustRail() {
  return (
    <div className="trust-rail" aria-label="Privacy guarantees">
      <span>
        <LockKeyhole size={14} /> First scan stays on this device
      </span>
      <span>
        <EyeOff size={14} /> Raw content is never sent automatically
      </span>
      <span>
        <ClipboardCheck size={14} /> You approve the final context
      </span>
    </div>
  );
}

function ContextTool({
  strict,
  mode,
  onNotice,
}: {
  strict: boolean;
  mode: "sanitize" | "present";
  onNotice: (value: string) => void;
}) {
  const [source, setSource] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [output, setOutput] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<SourceScope>("selection");
  const invalidate = (value: string) => {
    setSource(value);
    setResult(null);
    setOutput("");
    setReviewed(false);
  };
  const loadScope = async (next: SourceScope) => {
    setScope(next);
    if (next === "paste") return;
    invalidate("");
    try {
      const text = next === "selection" ? await selection() : await pageText();
      if (!text) {
        onNotice(
          next === "selection"
            ? "Select text on the webpage first, then try again."
            : "No visible webpage text was available.",
        );
        return;
      }
      invalidate(text);
      onNotice(
        next === "selection"
          ? "Selected text loaded. It has not been shared."
          : "Visible page text loaded. Forms, images, scripts and hidden text were excluded.",
      );
    } catch (error) {
      onNotice((error as Error).message);
    }
  };
  const scan = () => {
    setBusy(true);
    try {
      const next = sanitize(source, strict);
      setResult(next);
      setOutput(next.sanitizedText);
      setReviewed(false);
      void countScan();
      onNotice(
        next.detections.length
          ? `${next.detections.length} private ${next.detections.length === 1 ? "detail" : "details"} found. Review every replacement before sharing.`
          : "No supported pattern was found. Review contextual details such as internal names before sharing.",
      );
    } catch (error) {
      onNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const safe = Boolean(result && reviewed && validateOutput(source, output));
  const findings = result?.detections ?? [];
  const categories = new Set(findings.map((finding) => finding.kind));
  const copy = async () => {
    if (!safe) return;
    try {
      await navigator.clipboard.writeText(output);
      onNotice(
        "Approved context copied. Only the sanitized preview was placed on your clipboard.",
      );
    } catch {
      onNotice(
        "Clipboard permission was denied. Try again from the installed extension.",
      );
    }
  };
  return (
    <>
      <section className="source-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-index">01 / SOURCE</span>
            <h2>
              {mode === "present"
                ? "Choose content for a clean meeting view"
                : "Choose what enters the privacy review"}
            </h2>
          </div>
          <span className="local-badge">
            <span /> ON-DEVICE FIRST PASS
          </span>
        </div>
        <div className="scope-grid" role="group" aria-label="Context source">
          <button
            className={scope === "selection" ? "selected" : ""}
            aria-pressed={scope === "selection"}
            onClick={() => void loadScope("selection")}
          >
            <span className="scope-icon">
              <ScanLine size={18} />
            </span>
            <span>
              <strong>Selected text</strong>
              <small>Best privacy · least context</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button
            className={scope === "visible" ? "selected" : ""}
            aria-pressed={scope === "visible"}
            onClick={() => void loadScope("visible")}
          >
            <span className="scope-icon">
              <FileText size={18} />
            </span>
            <span>
              <strong>Visible page</strong>
              <small>More context · more review</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button
            className={scope === "paste" ? "selected" : ""}
            aria-pressed={scope === "paste"}
            onClick={() => setScope("paste")}
          >
            <span className="scope-icon">
              <Copy size={18} />
            </span>
            <span>
              <strong>Paste content</strong>
              <small>Text from another source</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
      <section className="review-workspace">
        <div className="workspace-bar">
          <div>
            <span className="panel-index">02 / SCAN & REVIEW</span>
            <h2>Private context review</h2>
          </div>
          <div className="workspace-state">
            <span>{source.length.toLocaleString()} characters</span>
            <span className={result ? "state-ready" : ""}>
              {result ? `${findings.length} found` : "Not scanned"}
            </span>
          </div>
        </div>
        <div className="editors">
          <div className="editor">
            <div className="editor-label">
              <label htmlFor="source">Original</label>
              <span>STAYS ON DEVICE</span>
            </div>
            <textarea
              id="source"
              maxLength={100000}
              value={source}
              onChange={(event) => invalidate(event.target.value)}
              placeholder="Select webpage text, load the visible page, or paste content here."
            />
            <div className="editor-foot">
              <button
                className="text-button"
                onClick={() => invalidate(sample)}
              >
                Try synthetic sample
              </button>
              <button className="text-button" onClick={() => invalidate("")}>
                Clear
              </button>
            </div>
          </div>
          <div className="editor output">
            <div className="editor-label">
              <label htmlFor="output">AI-safe preview</label>
              <span>{result ? "EDITABLE" : "WAITING FOR SCAN"}</span>
            </div>
            <textarea
              id="output"
              value={output}
              disabled={!result}
              onChange={(event) => {
                setOutput(event.target.value);
                setReviewed(false);
              }}
              placeholder="The sanitized version will appear here."
            />
            <div className="editor-foot">
              <span>Edit anything the scanner missed.</span>
              <button
                className="text-button"
                disabled={!result}
                onClick={() => {
                  const element = document.getElementById(
                    "output",
                  ) as HTMLTextAreaElement;
                  if (element.selectionStart === element.selectionEnd) {
                    onNotice("Select text in the AI-safe preview first.");
                    return;
                  }
                  setOutput(
                    output.slice(0, element.selectionStart) +
                      "[MANUALLY_REDACTED]" +
                      output.slice(element.selectionEnd),
                  );
                  setReviewed(false);
                }}
              >
                Hide selected text
              </button>
            </div>
          </div>
        </div>
        <div className="workspace-actions">
          <button
            className="primary"
            disabled={!source.trim() || busy}
            onClick={scan}
          >
            <ShieldCheck size={17} /> {busy ? "Scanning…" : "Scan & sanitize"}
          </button>
          <span>
            <LockKeyhole size={13} /> Email, phone, IDs and known secret
            patterns are checked locally.
          </span>
        </div>
      </section>
      {result && (
        <section className="findings-panel">
          <div className="findings-summary">
            <div className="score-ring">
              <strong>{findings.length}</strong>
              <span>FOUND</span>
            </div>
            <div>
              <span className="panel-index">PRIVACY REVIEW</span>
              <h2>
                {findings.length
                  ? "Check every proposed replacement"
                  : "No known patterns detected"}
              </h2>
              <p>
                {categories.size
                  ? `${categories.size} data ${categories.size === 1 ? "category" : "categories"} detected.`
                  : "Contextual or company-specific information may still need manual masking."}
              </p>
            </div>
          </div>
          <div className="finding-list">
            {findings.map((finding) => (
              <div className="finding" key={finding.id}>
                <span className="finding-kind">
                  {finding.kind.replaceAll("_", " ")}
                </span>
                <code>
                  {finding.kind === "SECRET"
                    ? "•••••••• (secret hidden)"
                    : source.slice(finding.start, finding.end)}
                </code>
                <ArrowRight size={15} aria-label="becomes" />
                <code className="replacement">{finding.replacement}</code>
                <span className="finding-status">
                  <Check size={13} /> REPLACED
                </span>
              </div>
            ))}
          </div>
          <label className="approval-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            <span>
              <strong>I approve this exact context</strong>
              <small>
                I checked the complete preview and manually removed anything
                missed.
              </small>
            </span>
          </label>
          {reviewed && !safe && (
            <p className="error">
              Sharing is blocked because a detected private value remains in the
              preview.
            </p>
          )}
        </section>
      )}
      {result && (
        <section className="release-panel">
          <div>
            <span className="panel-index">03 / RELEASE</span>
            <h2>Use the reviewed copy</h2>
            <p>Nothing is sent until you choose an action.</p>
          </div>
          <div className="release-actions">
            <button
              className="primary"
              disabled={!safe}
              onClick={() => void copy()}
            >
              <Copy size={16} /> Copy sanitized text
            </button>
            <button
              disabled={!safe}
              onClick={() =>
                void openMeetingView(source, output, reviewed)
                  .then(() =>
                    onNotice(
                      "Clean meeting view opened. Share only that new tab.",
                    ),
                  )
                  .catch((error) => onNotice(error.message))
              }
            >
              <MonitorUp size={16} /> Open clean meeting tab
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function SanitizeStudio({
  strict,
  onNotice,
}: {
  strict: boolean;
  onNotice: (value: string) => void;
}) {
  const [format, setFormat] = useState<"text" | "image">("text");
  return (
    <>
      <div className="format-switch" role="group" aria-label="Content format">
        <button
          className={format === "text" ? "selected" : ""}
          aria-pressed={format === "text"}
          onClick={() => setFormat("text")}
        >
          <FileText size={16} /> Text
        </button>
        <button
          className={format === "image" ? "selected" : ""}
          aria-pressed={format === "image"}
          onClick={() => setFormat("image")}
        >
          <ImageIcon size={16} /> Screenshot
        </button>
      </div>
      {format === "text" ? (
        <ContextTool strict={strict} mode="sanitize" onNotice={onNotice} />
      ) : (
        <Screenshot />
      )}
    </>
  );
}
function Preferences({
  strict,
  setStrict,
  onNotice,
}: {
  strict: boolean;
  setStrict: (value: boolean) => void;
  onNotice: (value: string) => void;
}) {
  const [activity, setActivity] = useState(false);
  const [count, setCount] = useState(0);
  useEffect(() => {
    void readSettings().then((settings) => {
      setActivity(Boolean(settings.activity));
      setCount(Number(settings.counts) || 0);
    });
  }, []);
  return (
    <section className="settings-card">
      <div className="settings-heading">
        <div>
          <span className="panel-index">DEFAULT PROTECTION</span>
          <h2>Privacy decisions</h2>
        </div>
        <span className="local-badge">
          <span /> NO ACCOUNT
        </span>
      </div>
      <div className="setting-row">
        <div>
          <h3>Replacement policy</h3>
          <p>
            Balanced keeps useful relationships with consistent aliases. Strict
            replaces every recognized private value with a neutral label.
          </p>
        </div>
        <select
          aria-label="Redaction policy"
          value={strict ? "strict" : "balanced"}
          onChange={(event) => {
            const value = event.target.value === "strict";
            setStrict(value);
            void saveSettings({ strict: value });
          }}
        >
          <option value="balanced">Balanced</option>
          <option value="strict">Strict</option>
        </select>
      </div>
      <div className="setting-row">
        <div>
          <h3>Private activity counter</h3>
          <p>
            Stores only a total number on this device. Text, screenshots, URLs
            and destinations are never included.
          </p>
        </div>
        <label className="switch">
          <input
            aria-label="Enable local activity"
            type="checkbox"
            checked={activity}
            onChange={(event) => {
              setActivity(event.target.checked);
              void saveSettings({ activity: event.target.checked });
            }}
          />
          <span />
        </label>
      </div>
      <div className="setting-row">
        <div>
          <h3>Optional AI relevance check</h3>
          <p>
            An optional AI check may send only selected, locally reduced blocks
            after consent. The API key stays outside the extension package.
          </p>
        </div>
        <span className="policy-state">OPTIONAL</span>
      </div>
      <div className="settings-actions">
        <span>{count} approved local scans counted</span>
        <button
          onClick={() => {
            void saveSettings({ counts: 0 });
            setCount(0);
            onNotice("The local activity count was deleted.");
          }}
        >
          Delete count
        </button>
        <button
          onClick={() => {
            if (isExtension)
              void chrome.permissions
                .remove({ origins: ["http://127.0.0.1/*"] })
                .then(() => onNotice("Local API access was revoked."));
          }}
        >
          Revoke AI processing access
        </button>
        <button
          onClick={() =>
            void clearMeanings().then(() =>
              onNotice(
                "Saved semantic meanings cleared. Current masks stay active until protection is turned off.",
              ),
            )
          }
        >
          Clear semantic cache
        </button>
      </div>
      <div className="capability-grid">
        <div>
          <CheckCircle2 size={17} />
          <strong>Protected</strong>
          <span>Reviewed copies, screenshots and supported tab content</span>
        </div>
        <div>
          <EyeOff size={17} />
          <strong>Needs review</strong>
          <span>Images, frames, internal names and contextual secrets</span>
        </div>
        <div>
          <MonitorUp size={17} />
          <strong>Outside extension</strong>
          <span>Entire desktop and native browser AI controls</span>
        </div>
      </div>
    </section>
  );
}

function App() {
  const requested = new URLSearchParams(location.search).get("tool");
  const initial: Tool =
    requested === "text"
      ? "ask"
      : requested === "image"
        ? "sanitize"
        : tools.some((item) => item.id === requested)
          ? (requested as Tool)
          : "ask";
  const [tool, setTool] = useState<Tool>(initial);
  const [notice, setNotice] = useState("");
  const [strict, setStrict] = useState(false);
  const [onboarded, setOnboarded] = useState(true);
  useEffect(() => {
    void readSettings().then((settings) => {
      setStrict(Boolean(settings.strict));
      setOnboarded(Boolean(settings.onboarded) || !isExtension);
    });
  }, []);
  const title = pageTitles[tool];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Privacy tools">
          {tools.map((item, index) => (
            <button
              key={item.id}
              className={tool === item.id ? "selected" : ""}
              aria-label={item.label}
              onClick={() => {
                setTool(item.id);
                setNotice("");
              }}
            >
              <span className="nav-index">0{index + 1}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="pulse" /> PROTECTION READY
          <small>Local-first · user approved</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <Brand compact />
          <div className="session-state">
            <ShieldCheck size={15} /> PRIVATE SESSION
          </div>
        </header>
        {!isExtension && (
          <div className="preview-alert">
            <strong>DESIGN PREVIEW</strong>
            <span>
              Load the built extension to use webpage and tab controls.
            </span>
          </div>
        )}
        <section className="page-heading">
          <span className="eyebrow">{title[0]}</span>
          <h1>{title[1]}</h1>
          <p>{title[2]}</p>
        </section>
        <TrustRail />
        {!onboarded && (
          <section className="onboarding">
            <span className="panel-index">BEFORE YOU BEGIN</span>
            <h2>You remain the final decision maker.</h2>
            <p>
              PrivacyShield proposes replacements and blocks known secrets from
              the approved copy. Review the exact result before anything leaves
              the extension.
            </p>
            <button
              className="primary"
              onClick={() => {
                setOnboarded(true);
                void saveSettings({ onboarded: true });
              }}
            >
              Get started <ArrowRight size={16} />
            </button>
          </section>
        )}
        {notice && (
          <div className="notice status" role="status">
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {tool === "ask" && <AskPrivately onNotice={setNotice} />}
        {tool === "present" && (
          <>
            <MeetingGuide onNotice={setNotice} />
            <ContextTool strict={strict} mode="present" onNotice={setNotice} />
          </>
        )}
        {tool === "sanitize" && (
          <SanitizeStudio strict={strict} onNotice={setNotice} />
        )}
        {tool === "settings" && (
          <Preferences
            strict={strict}
            setStrict={setStrict}
            onNotice={setNotice}
          />
        )}
        <footer>
          <span>PRIVACYSHIELD / CONTEXT FIREWALL</span>
          <span>
            No telemetry · No automatic uploads · User-approved release
          </span>
        </footer>
      </main>
    </div>
  );
}
function Popup() {
  const [note, setNote] = useState(
    "Open a webpage to begin a private session.",
  );
  const [mask, setMask] = useState(false);
  useEffect(() => {
    void modeStatus()
      .then((value) => {
        setMask(value);
        setNote(
          value
            ? "Tab masking is active. Inspect before sharing."
            : "Ready to protect this webpage.",
        );
      })
      .catch(() => setNote("Open a regular webpage to use tab protection."));
  }, []);
  const open = (tool: Tool) => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) =>
        chrome.tabs.create({
          url: chrome.runtime.getURL(
            `index.html?tool=${tool}&targetTab=${tab?.id ?? ""}`,
          ),
        }),
      );
  };
  return (
    <div className="popup">
      <div className="popup-top">
        <Brand compact />
        <span className="popup-status">
          <span /> READY
        </span>
      </div>
      <div className="popup-hero">
        <span>PRIVATE SESSION</span>
        <h1>Control what leaves this page.</h1>
        <p>{note}</p>
      </div>
      <label className="recording-toggle popup-toggle">
        <span>
          <strong>Presentation / recording privacy</strong>
          <small>Blur private details on this tab.</small>
        </span>
        <input
          aria-label="Privacy on this tab"
          role="switch"
          type="checkbox"
          checked={mask}
          onChange={(event) => {
            const enabled = event.target.checked;
            void (
              enabled
                ? currentTab().then((tab) => {
                    const whatsapp =
                      new URL(tab.url!).hostname === "web.whatsapp.com";
                    return enableMode({
                      treatment: "blur",
                      detected: true,
                      fields: true,
                      contacts: whatsapp,
                      avatars: true,
                      previews: whatsapp,
                    });
                  })
                : disableMode()
            )
              .then(() => {
                setMask(enabled);
                setNote(
                  enabled
                    ? "Privacy is on. Inspect the tab before sharing or recording."
                    : "Protection is off; original content restored.",
                );
              })
              .catch((error) => setNote(error.message));
          }}
        />
      </label>
      <button
        className="primary wide"
        onClick={() => {
          void currentTab()
            .then((tab) => chrome.sidePanel.open({ tabId: tab.id! }))
            .then(() => window.close())
            .catch(() => setNote("Open a regular webpage first."));
        }}
      >
        <Sparkles size={17} /> Ask AI privately <ArrowRight size={16} />
      </button>
      <button className="wide" onClick={() => open("present")}>
        <MonitorUp size={17} />{" "}
        {mask ? "Review active private preview" : "Present this tab safely"}
      </button>
      <button className="wide" onClick={() => open("sanitize")}>
        <ShieldCheck size={17} /> Open sanitization studio
      </button>
      <button className="popup-link" onClick={() => open("settings")}>
        <Settings size={15} /> Privacy settings
      </button>
      <div className="popup-proof">
        <LockKeyhole size={15} />
        <span>
          <strong>Nothing is sent automatically.</strong> You review and approve
          the final context.
        </span>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  location.pathname.endsWith("popup.html") ? <Popup /> : <App />,
);
