import React, { useEffect, useState } from "react";
import {
  Check,
  EyeOff,
  MousePointer2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  currentTab,
  disableMode,
  enableMode,
  isExtension,
  maskReport,
  rescanMasks,
  startMaskPicker,
  undoManualMasks,
  clearManualMasks,
  finishMaskPicker,
  type MaskOptions,
  type MaskReport,
} from "./runtime";
import { watchStatus, setShareWatch } from "./share-watch";
import { SemanticReview } from "./semantic-review";
import { prepareSemanticPage, applySemanticPage } from "./runtime";
import { FieldReview } from "./field-review";

const defaultOptions: MaskOptions = {
  treatment: "blur",
  detected: true,
  fields: true,
  contacts: false,
  avatars: true,
  previews: false,
};

export function MeetingGuide({
  onNotice,
}: {
  onNotice: (value: string) => void;
}) {
  const [scope, setScope] = useState<"tab" | "screen" | "snapshot">("tab");
  const [state, setState] = useState<"unknown" | "on" | "off">("unknown");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [site, setSite] = useState<"whatsapp" | "generic">("generic");
  const [options, setOptions] = useState<MaskOptions>(defaultOptions);
  const [report, setReport] = useState<MaskReport | null>(null);
  const [watching, setWatching] = useState(false);

  const refresh = async () => {
    try {
      const current = await maskReport();
      setReport(current);
      setState(current?.active ? "on" : "off");
      if (current?.site) setSite(current.site);
    } catch {
      setState("unknown");
    }
  };

  useEffect(() => {
    if (!isExtension) return;
    void currentTab()
      .then((tab) => {
        const whatsapp = new URL(tab.url!).hostname === "web.whatsapp.com";
        setSite(whatsapp ? "whatsapp" : "generic");
        if (whatsapp)
          setOptions({
            treatment: "blur",
            detected: true,
            fields: true,
            contacts: true,
            avatars: true,
            previews: true,
          });
      })
      .catch(() => undefined);
    void refresh();
    void watchStatus()
      .then((status) => setWatching(status.enabled))
      .catch(() => {});
    const interval = setInterval(() => void refresh(), 1200);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const updateOption = (key: Exclude<keyof MaskOptions, "treatment">) => {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
    setChecked(false);
  };

  const apply = async () => {
    setBusy(true);
    setChecked(false);
    try {
      const next = await enableMode(options);
      setReport(next);
      setState("on");
      onNotice(
        "Private preview is ready. All controls remain inside PrivacyShield and will not appear in the shared tab.",
      );
    } catch (error) {
      setState("unknown");
      onNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await disableMode();
      setReport(null);
      setState("off");
      setChecked(false);
      onNotice(
        "Private preview turned off and supported content was restored.",
      );
    } catch (error) {
      onNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeTreatment = (treatment: "blur" | "hide") => {
    const next = { ...options, treatment };
    setOptions(next);
    setChecked(false);
    if (state === "on") {
      setBusy(true);
      void enableMode(next)
        .then(setReport)
        .then(() =>
          onNotice(
            `Active tab updated to ${treatment}. Inspect it before sharing.`,
          ),
        )
        .catch((error) => onNotice(error.message))
        .finally(() => setBusy(false));
    }
  };

  const total = report
    ? report.detectedText +
      report.contactNames +
      report.profileImages +
      report.previews +
      report.fields +
      report.structuredFields +
      report.manual
    : 0;

  return (
    <section className="meeting-guide" aria-label="Private presentation setup">
      <div className="guide-title">
        <div>
          <span className="panel-index">PRIVATE SHARE SETUP</span>
          <h2>Prepare the tab before you present</h2>
        </div>
        <span className={`mode-state ${state === "on" ? "enabled" : ""}`}>
          {!isExtension
            ? "PREVIEW ONLY"
            : state === "on"
              ? `${total} PROTECTION MATCHES`
              : "NOT ACTIVE"}
        </span>
      </div>
      <p className="guide-intro">
        Choose what may identify you or another person. PrivacyShield creates a
        private preview first; you inspect it, then start sharing from your
        meeting app.
      </p>
      <div className="recording-controls">
        <label className="recording-toggle">
          <span>
            <strong>Presentation / recording privacy</strong>
            <small>Protect this browser tab before either activity.</small>
          </span>
          <input
            aria-label="Presentation and recording privacy"
            role="switch"
            type="checkbox"
            disabled={busy}
            checked={state === "on"}
            onChange={() => void (state === "on" ? stop() : apply())}
          />
        </label>
        <label className="recording-toggle">
          <span>
            <strong>Automatic sharing reminders on this site</strong>
            <small>
              Optional site access. Reload the meeting site after enabling.
            </small>
          </span>
          <input
            aria-label="Automatic sharing reminders"
            role="switch"
            type="checkbox"
            disabled={busy}
            checked={watching}
            onChange={(event) => {
              const enabled = event.target.checked;
              setBusy(true);
              void setShareWatch(enabled)
                .then(setWatching)
                .then(() =>
                  onNotice(
                    enabled
                      ? "Sharing reminders enabled for this site. Reload it to catch early capture calls. Prepare the actual source tab before continuing."
                      : "Sharing reminders disabled on this site.",
                  ),
                )
                .catch((error) => onNotice(error.message))
                .finally(() => setBusy(false));
            }}
          />
        </label>
        <p className="context-help">
          Reminders detect this site’s browser capture requests and recordings
          using those streams. Native meeting apps, OBS and operating-system
          recording cannot be detected. A reminder never starts capture or turns
          protection on without your choice.
        </p>
      </div>
      <fieldset className="treatment-options">
        <legend>How should private content look?</legend>
        <label>
          <input
            type="radio"
            name="mask-treatment"
            value="blur"
            checked={options.treatment === "blur"}
            onChange={() => changeTreatment("blur")}
          />
          <span>
            <strong>Blur</strong>
            <small>
              Keep the layout and signal that private content is covered.
            </small>
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="mask-treatment"
            value="hide"
            checked={options.treatment === "hide"}
            onChange={() => changeTreatment("hide")}
          />
          <span>
            <strong>Hide</strong>
            <small>Remove it from view while preserving the page layout.</small>
          </span>
        </label>
      </fieldset>
      <p className="context-help">
        Credentials are hidden even in blur mode. Blur is visual concealment and
        can leave clues; use Hide for high-risk content. Apply changes before
        sharing.
      </p>
      <div className="scope-options" role="group" aria-label="Sharing scope">
        <button aria-pressed={scope === "tab"} onClick={() => setScope("tab")}>
          A browser tab
        </button>
        <button
          aria-pressed={scope === "screen"}
          onClick={() => setScope("screen")}
        >
          My entire screen
        </button>
        <button
          aria-pressed={scope === "snapshot"}
          onClick={() => setScope("snapshot")}
        >
          Clean text snapshot
        </button>
      </div>
      {scope === "screen" ? (
        <div className="scope-warning">
          <h3>Entire-screen sharing cannot be privately filtered.</h3>
          <p>
            Chrome includes every visible window and notification. Choose a
            browser tab in Meet, Zoom, or Teams so PrivacyShield can control the
            page being shared.
          </p>
          <button className="primary" onClick={() => setScope("tab")}>
            Protect a browser tab instead
          </button>
        </div>
      ) : scope === "snapshot" ? (
        <div className="snapshot-note">
          <ShieldCheck size={20} />
          <div>
            <h3>Create a clean, static meeting view</h3>
            <p>
              Use the text review below, approve the replacements, then choose
              Open clean meeting tab. Share only that new tab.
            </p>
          </div>
        </div>
      ) : (
        <>
          {site === "whatsapp" && (
            <div className="site-preset">
              <span className="site-icon">WA</span>
              <div>
                <strong>WhatsApp privacy preset</strong>
                <p>
                  Contact names, profile images, sidebar message previews, form
                  fields, and recognized private details are selected.
                </p>
              </div>
              <span>AUTOMATIC</span>
            </div>
          )}
          <fieldset className="mask-options">
            <legend>What should be covered?</legend>
            <label>
              <input
                type="checkbox"
                checked={options.contacts}
                onChange={() => updateOption("contacts")}
              />
              <span>
                <strong>Contact and chat names</strong>
                <small>
                  Includes the active chat header and visible chat list
                </small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.avatars}
                onChange={() => updateOption("avatars")}
              />
              <span>
                <strong>Profile images</strong>
                <small>
                  Covers identifying photos and signatures in detected personal
                  forms
                </small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.previews}
                onChange={() => updateOption("previews")}
              />
              <span>
                <strong>Sidebar previews</strong>
                <small>
                  Hides message snippets outside the chat being presented
                </small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.detected}
                onChange={() => updateOption("detected")}
              />
              <span>
                <strong>Detected private details</strong>
                <small>
                  Email, phone, IDs, credentials, and labelled private fields
                </small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.fields}
                onChange={() => updateOption("fields")}
              />
              <span>
                <strong>Editable fields</strong>
                <small>
                  Search, compose, and form fields that can expose typed content
                </small>
              </span>
            </label>
          </fieldset>
          <div className="guide-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void apply()}
            >
              <EyeOff size={16} />
              {busy
                ? "Preparing preview…"
                : state === "on"
                  ? "Update private preview"
                  : "Create private preview"}
            </button>
            {state === "on" && (
              <button disabled={busy} onClick={() => void stop()}>
                Turn protection off
              </button>
            )}
          </div>
          {report && state === "on" && (
            <div className="private-report">
              <div className="report-head">
                <div>
                  <span className="panel-index">PRIVATE TAB REPORT</span>
                  <h3>What the preview changed</h3>
                </div>
                <button
                  onClick={() =>
                    void rescanMasks()
                      .then(setReport)
                      .catch((error) => onNotice(error.message))
                  }
                >
                  <RotateCcw size={14} /> Refresh
                </button>
              </div>
              <div className="report-grid">
                <span>
                  <b>{report.contactNames}</b> contact names
                </span>
                <span>
                  <b>{report.profileImages}</b> profile images
                </span>
                <span>
                  <b>{report.previews}</b> sidebar previews
                </span>
                <span>
                  <b>{report.detectedText}</b> private text regions
                </span>
                <span>
                  <b>{report.fields}</b> editable fields
                </span>
                <span>
                  <b>{report.structuredFields}</b> labelled personal fields
                </span>
                <span>
                  <b>{report.manual}</b> manually hidden areas
                </span>
              </div>
              {!!report.fieldTypes?.length && (
                <p className="field-summary">
                  <strong>Field types covered:</strong>{" "}
                  {report.fieldTypes
                    .map((field) => `${field.label} (${field.count})`)
                    .join(" · ")}
                  . Values stay on the page and are visually concealed.
                </p>
              )}
              <div className="manual-mask">
                <div>
                  <strong>Something was missed?</strong>
                  <p>
                    Click multiple areas on the webpage. Keep selecting until
                    Escape or Done; each area uses your chosen blur/hide
                    treatment.
                  </p>
                </div>
                <button
                  onClick={() =>
                    void startMaskPicker()
                      .then(() =>
                        onNotice(
                          "Click as many areas as needed. Press Escape or Done to finish. Undo restores only the last area.",
                        ),
                      )
                      .catch((error) => onNotice(error.message))
                  }
                >
                  <MousePointer2 size={15} /> Select an area to hide
                </button>
                {report.picking && (
                  <button
                    onClick={() =>
                      void finishMaskPicker()
                        .then(refresh)
                        .catch((error) => onNotice(error.message))
                    }
                  >
                    Done selecting
                  </button>
                )}
                <button
                  disabled={!report.manual}
                  onClick={() =>
                    void undoManualMasks()
                      .then(setReport)
                      .catch((error) => onNotice(error.message))
                  }
                >
                  Undo last area
                </button>
                <button
                  disabled={!report.manual}
                  onClick={() =>
                    void clearManualMasks()
                      .then(setReport)
                      .catch((error) => onNotice(error.message))
                  }
                >
                  Clear manual areas
                </button>
              </div>
              {!!report.semanticMatches && (
                <div>
                  <p>{report.semanticMatches} contextual protection matches</p>
                  <ul>
                    {report.semanticCategories?.map((entry) => (
                      <li key={entry.category}>
                        {entry.category}: {entry.count}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <SemanticReview
                purpose="prepare this page for screen sharing"
                allowCache
                onNotice={onNotice}
                prepare={prepareSemanticPage}
                apply={async (snapshot, decisions, reviewed, remember) => {
                  const next = await applySemanticPage(
                    snapshot.tabId,
                    snapshot.nonce,
                    { elements: decisions },
                    reviewed,
                    remember,
                  );
                  setReport(next);
                  setChecked(false);
                }}
              />
              <FieldReview
                onNotice={onNotice}
                onReport={(next) => {
                  setReport(next);
                  setChecked(false);
                }}
              />
              <div className="inspection-row">
                <button
                  onClick={() =>
                    void currentTab()
                      .then((tab) =>
                        chrome.tabs.update(tab.id!, { active: true }),
                      )
                      .catch((error) => onNotice(error.message))
                  }
                >
                  Inspect the cleaned tab ↗
                </button>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  <span>I inspected the exact tab I will share.</span>
                </label>
              </div>
              {checked && (
                <p className="verified-note">
                  <Check size={14} /> Ready. In your meeting app, choose{" "}
                  <strong>Share a tab</strong> and select the inspected page.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
