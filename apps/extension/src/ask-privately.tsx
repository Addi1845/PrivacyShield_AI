import { SemanticReview } from "./semantic-review";
import {
  reduceCandidate,
  confidencePolicy,
  priority,
} from "../../../packages/semantic-core";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  MousePointer2,
  Plus,
  ScanLine,
  X,
} from "lucide-react";
import {
  applyAiSubset,
  contextPacket,
  packetIsSafe,
  pasteCapture,
  prepareChoices,
  recognizedRiskCount,
  shoppingSample,
  type ContextCapture,
  type ContextChoice,
} from "../../../packages/context-core";
import { sanitize } from "../../../packages/privacy-core";
import { cancelContextPick, readContext } from "./context-capture";
import { countScan, currentTab, isExtension } from "./runtime";
import { openChosenAi, type AiDestination } from "./sharing";

export function AskPrivately({
  onNotice,
}: {
  onNotice: (value: string) => void;
}) {
  const [task, setTask] = useState("");
  const [capture, setCapture] = useState<ContextCapture | null>(null);
  const [choices, setChoices] = useState<ContextChoice[]>([]);
  const [output, setOutput] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [destination, setDestination] = useState<AiDestination>("Gemini");
  const target = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const preview = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => () => {
      generation.current++;
      abort.current?.abort();
      if (target.current !== undefined)
        void cancelContextPick(target.current).catch(() => {});
    },
    [],
  );
  const revoke = () => {
    setApproved(false);
    setAiConsent(false);
    setAiNote("");
  };
  const update = (next: ContextChoice[], question = task) => {
    setChoices(next);
    setOutput(contextPacket(question, next));
    revoke();
  };
  const load = (next: ContextCapture, question = task) => {
    setCapture(next);
    update(prepareChoices(next, question), question);
    void countScan();
  };
  const clear = () => {
    generation.current++;
    abort.current?.abort();
    if (picking && target.current !== undefined)
      void cancelContextPick(target.current).catch(() => {});
    target.current = undefined;
    setCapture(null);
    setChoices([]);
    setOutput("");
    setPaste("");
    setTask("");
    setBusy(false);
    setPicking(false);
    revoke();
    onNotice("Session cleared. No page content is saved.");
  };
  const collect = async (
    mode: "selection" | "section" | "element" | "area" | "page" | "main",
    append = false,
  ) => {
    if (!task.trim()) {
      onNotice("First describe what you want the AI to help with.");
      return;
    }
    const request = ++generation.current;
    setBusy(true);
    const picker = mode === "section" || mode === "element" || mode === "area";
    setPicking(picker);
    revoke();
    // A failed new capture must never leave an old packet ready for release.
    if (!append) {
      setCapture(null);
      setChoices([]);
      setOutput("");
    }
    let extensionTab: number | undefined;
    try {
      target.current ??= (await currentTab()).id!;
      if (picker) {
        extensionTab = (await chrome.tabs.getCurrent())?.id;
        await chrome.tabs.update(target.current, { active: true });
        onNotice(
          mode === "area"
            ? "Drag over the text on your webpage. Press Esc or Cancel to stop."
            : "Click an outlined element on your webpage. Press Esc or Cancel to stop.",
        );
      }
      const next = await readContext(mode, target.current);
      if (request !== generation.current) return;
      if (append && capture) {
        const additions = next.blocks
          .filter((b) => !capture.blocks.some((old) => old.text === b.text))
          .map((b) => ({
            ...b,
            section: b.section
              ? `extra${capture.blocks.length}-${b.section}`
              : undefined,
          }));
        const merged = {
          ...capture,
          omitted: capture.omitted + next.omitted,
          blocks: [...capture.blocks, ...additions].map((b, index) => ({
            ...b,
            id: `b${index}`,
          })),
        };
        if (
          merged.blocks.length > 120 ||
          merged.blocks.map((b) => b.text).join("\n").length > 30000
        )
          throw new Error(
            "The combined context is too large. Start a smaller session.",
          );
        setCapture(merged);
        const newChoices = prepareChoices(merged, task);
        update(
          newChoices.map(
            (b) => choices.find((old) => old.text === b.text) ?? b,
          ),
        );
      } else load(next);
      onNotice(
        "Chosen content captured locally. Review the included blocks and exact outgoing context.",
      );
    } catch (error) {
      if (request === generation.current)
        onNotice(
          error instanceof Error
            ? error.message
            : "Could not collect that scope. Try a smaller selection.",
        );
    } finally {
      if (extensionTab !== undefined)
        void chrome.tabs.update(extensionTab, { active: true }).catch(() => {});
      if (request === generation.current) {
        setBusy(false);
        setPicking(false);
      }
    }
  };
  const safe = !busy && approved && packetIsSafe(task, choices, output);
  const selected = choices.filter((b) => b.included && !b.locked);
  const original = [task, ...choices.map((b) => b.text)].join("\n");
  const send = async (open: boolean) => {
    if (!safe || !packetIsSafe(task, choices, output)) return;
    try {
      if (open) await openChosenAi(destination, original, output, approved);
      else await navigator.clipboard.writeText(output);
      onNotice(
        open
          ? `Reviewed context copied; ${destination} opened. Paste it into a new chat with page access turned off.`
          : "Approved context copied. Only this preview is on your clipboard.",
      );
    } catch {
      onNotice(
        "The handoff could not finish. Your approved context remains here; try copying it again.",
      );
    }
  };
  const checkAi = async () => {
    if (
      !aiConsent ||
      busy ||
      output !== contextPacket(task, choices) ||
      !packetIsSafe(task, choices, output)
    )
      return;
    const request = ++generation.current;
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    setBusy(true);
    setApproved(false);
    setAiNote("");
    try {
      if (
        isExtension &&
        !(await chrome.permissions.request({ origins: ["http://127.0.0.1/*"] }))
      )
        throw new Error(
          "AI processing permission was not granted. The local draft is still available.",
        );
      const response = await fetch("http://127.0.0.1:4318/minimize-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          consent: true,
          purpose: sanitize(task, true).sanitizedText,
          blocks: selected.map((b) => ({ id: b.id, text: b.cleaned })),
        }),
      });
      const result = await response.json();
      if (request !== generation.current) return;
      if (!response.ok)
        throw new Error(
          result.error ?? "AI check unavailable. Keep using the local draft.",
        );
      const next = applyAiSubset(choices, result.keepIds);
      if (!packetIsSafe(task, next, contextPacket(task, next)))
        throw new Error("The AI check failed validation. Your draft was kept.");
      const removed = selected.length - next.filter((b) => b.included).length;
      update(next);
      setAiNote(
        `AI relevance check removed ${removed} block${removed === 1 ? "" : "s"}. Facts were not rewritten. Review and approve again.`,
      );
      onNotice("AI check completed. You remain the final decision maker.");
    } catch (error) {
      if (request === generation.current)
        onNotice(
          error instanceof Error
            ? error.message
            : "AI check unavailable. Your local draft is unchanged.",
        );
    } finally {
      clearTimeout(timer);
      if (request === generation.current) {
        setBusy(false);
        setAiConsent(false);
      }
    }
  };
  return (
    <div className="private-flow">
      <section className="context-start" aria-labelledby="context-task-heading">
        <div className="context-step-heading">
          <span className="panel-index">01 / DEFINE THE TASK</span>
          <button className="subtle" onClick={clear}>
            Clear session
          </button>
        </div>
        <h2 id="context-task-heading">What should AI help you with?</h2>
        <label className="task-label" htmlFor="private-task">
          Your question
        </label>
        <textarea
          id="private-task"
          rows={2}
          maxLength={500}
          value={task}
          disabled={busy}
          placeholder="Compare these two laptops for coding under ₹70,000."
          onChange={(event) => {
            setTask(event.target.value);
            if (capture)
              update(
                prepareChoices(capture, event.target.value),
                event.target.value,
              );
            else revoke();
          }}
        />
        <p className="context-help">
          The task guides what to include. Recognized private details in your
          question are replaced too.
        </p>
        <div className="context-step-heading">
          <span className="panel-index">02 / CHOOSE THE CONTEXT</span>
          <span className="local-badge">ON THIS DEVICE</span>
        </div>
        <div className="context-source-actions">
          <button disabled={busy} onClick={() => void collect("element")}>
            Pick any element
          </button>
          <button disabled={busy} onClick={() => void collect("area")}>
            Drag an area
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void collect("section")}
          >
            <MousePointer2 size={16} />
            Choose a section
          </button>
          <button disabled={busy} onClick={() => void collect("selection")}>
            Use highlighted text
          </button>
          <button disabled={busy} onClick={() => void collect("main")}>
            Find main content
          </button>
          <button disabled={busy} onClick={() => void collect("page")}>
            Scan this page
          </button>
          <button disabled={busy} onClick={() => setPasteOpen(!pasteOpen)}>
            Paste an excerpt
          </button>
        </div>
        <p className="context-help">
          Pick a readable element, row, paragraph or text rectangle. Explicit
          selections can include navigation and displayed form text; private
          values are checked before handoff. Input values, images and frames
          need separate capture/OCR. No raw page is sent to AI.
        </p>
        {picking && (
          <div className="picker-notice" role="status">
            <MousePointer2 size={16} /> Switch to your webpage and click the
            outlined section.<button onClick={clear}>Cancel selection</button>
          </div>
        )}
        {pasteOpen && (
          <div className="context-paste">
            <label htmlFor="context-excerpt">
              Relevant excerpt (kept only in this session)
            </label>
            <textarea
              id="context-excerpt"
              rows={5}
              value={paste}
              maxLength={30000}
              disabled={busy}
              onChange={(e) => {
                setPaste(e.target.value);
                setCapture(null);
                setChoices([]);
                setOutput("");
                revoke();
              }}
            />
            <button
              disabled={busy}
              onClick={() => {
                try {
                  if (!task.trim())
                    throw new Error("Describe your task first.");
                  load(pasteCapture(paste));
                  onNotice(
                    "Excerpt checked locally. Review the context below.",
                  );
                } catch (error) {
                  onNotice((error as Error).message);
                }
              }}
            >
              Build context
            </button>
          </div>
        )}
        {!capture && (
          <button
            className="example-link"
            disabled={busy}
            onClick={() => {
              const question =
                "Compare the two laptops for coding under ₹70,000.";
              setTask(question);
              setPasteOpen(false);
              load(pasteCapture(shoppingSample), question);
              onNotice(
                "Synthetic shopping example loaded. Product facts stay; account details do not.",
              );
            }}
          >
            Try a shopping example <ArrowUpRight size={13} />
          </button>
        )}
      </section>
      {capture && (
        <>
          <section
            className="context-review"
            aria-labelledby="context-review-heading"
          >
            <div className="context-step-heading">
              <span className="panel-index">03 / REVIEW THE BOUNDARY</span>
              <button
                disabled={busy}
                onClick={() => void collect("section", true)}
              >
                <Plus size={14} />
                Add a section
              </button>
            </div>
            <h2 id="context-review-heading">Useful context. Less exposure.</h2>
            <div className="context-stats">
              <div>
                <strong>{selected.length}</strong>
                <span>included blocks</span>
              </div>
              <div>
                <strong>{choices.length - selected.length}</strong>
                <span>excluded blocks</span>
              </div>
              <div>
                <strong>{recognizedRiskCount(task, choices)}</strong>
                <span>recognized private patterns</span>
              </div>
            </div>
            <p className="context-help">
              {capture.omitted > 0
                ? `${capture.omitted} surrounding or unsupported text fragments were skipped. `
                : ""}
              Excluding an account name or address reduces identity exposure;
              excluding history reduces unrelated behavior shared with AI. It
              does not make the chat anonymous.
            </p>
            <div className="context-blocks">
              {choices.map((block, index) => (
                <div
                  key={block.id}
                  className={`context-block ${block.included ? "included" : "excluded"}`}
                >
                  <div className="context-block-top">
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Include block ${index + 1}`}
                        checked={block.included}
                        disabled={block.locked || busy}
                        onChange={(e) =>
                          update(
                            choices.map((b) =>
                              b.id === block.id
                                ? { ...b, included: e.target.checked }
                                : b,
                            ),
                          )
                        }
                      />
                      Block {index + 1}
                    </label>
                    <span>
                      {block.locked ? (
                        <>
                          <X size={12} />
                          PRIVATE / EXCLUDED
                        </>
                      ) : block.included ? (
                        <>
                          <Check size={12} />
                          INCLUDED
                        </>
                      ) : (
                        "NOT NEEDED"
                      )}
                    </span>
                  </div>
                  <p>
                    {block.locked
                      ? "This block contains a private or surrounding field. Its value is not part of the outgoing context."
                      : block.cleaned}
                  </p>
                  <small>{block.reason}</small>
                </div>
              ))}
            </div>
          </section>
          <section
            className="context-outgoing"
            aria-labelledby="context-outgoing-heading"
          >
            <div className="context-step-heading">
              <span className="panel-index">
                04 / APPROVE THE EXACT HANDOFF
              </span>
              <span className="local-badge">FROZEN SNAPSHOT</span>
            </div>
            <h2 id="context-outgoing-heading">
              This is everything you will copy.
            </h2>
            <label htmlFor="private-preview">AI-safe preview</label>
            <textarea
              ref={preview}
              id="private-preview"
              rows={9}
              value={output}
              disabled={busy}
              onChange={(e) => {
                setOutput(e.target.value);
                revoke();
              }}
            />
            <div className="context-preview-actions">
              <button
                disabled={busy || !output}
                onClick={() => {
                  const el = preview.current;
                  if (!el || el.selectionStart === el.selectionEnd) {
                    onNotice("Highlight a detail in the preview to remove it.");
                    return;
                  }
                  setOutput(
                    output.slice(0, el.selectionStart) +
                      "[REDACTED_PRIVATE]" +
                      output.slice(el.selectionEnd),
                  );
                  revoke();
                }}
              >
                Remove selected detail
              </button>
              <button disabled={busy} onClick={() => update(choices)}>
                Rebuild preview
              </button>
            </div>
            <SemanticReview
              key={JSON.stringify(
                capture?.blocks.map(({ id, text, fieldLabel }) => ({
                  id,
                  text,
                  fieldLabel,
                })),
              )}
              purpose="minimize selected context"
              onNotice={onNotice}
              prepare={async () => {
                const mapping: Record<string, string> = {};
                const elements = choices
                  .filter((b) => !b.locked)
                  .flatMap((b) => {
                    const id = `e${Object.keys(mapping).length}`;
                    const reduced = reduceCandidate({
                      id,
                      text: b.text,
                      label: b.fieldLabel,
                    });
                    if (!reduced || Object.keys(mapping).length >= 50)
                      return [];
                    mapping[id] = b.id;
                    return [reduced];
                  });
                return {
                  nonce: JSON.stringify(capture),
                  elements,
                  mapping,
                  localCount: choices.filter((b) => b.locked).length,
                };
              }}
              apply={async (snapshot, decisions, reviewed) => {
                if (!capture || snapshot.nonce !== JSON.stringify(capture))
                  throw new Error("Context changed. Prepare a new review.");
                const protectedIds = new Set(
                  decisions
                    .filter(
                      (d) =>
                        reviewed.includes(d.id) ||
                        priority[confidencePolicy(d).action] >= priority.ALIAS,
                    )
                    .map((d) => snapshot.mapping[d.id]),
                );
                const next = {
                  ...capture,
                  blocks: capture.blocks.map((b) => ({
                    ...b,
                    semanticPrivate:
                      b.semanticPrivate || protectedIds.has(b.id),
                  })),
                };
                generation.current++;
                abort.current?.abort();
                setBusy(false);
                setCapture(next);
                update(prepareChoices(next, task));
              }}
            />
            <details className="context-ai-check">
              <summary>
                <ScanLine size={15} />
                Optional AI relevance check
              </summary>
              <p>
                Checks only the included, locally reduced blocks and question
                shown here. AI may suggest removing blocks; it cannot rewrite
                facts or collect more page content.
              </p>
              <p className="context-help">
                The backend uses Groq by default, or OpenRouter if configured.
                This check sends the included draft to its API; unrecognized
                sensitive context could remain. No API setup is needed in this
                screen.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={aiConsent}
                  disabled={busy}
                  onChange={(e) => setAiConsent(e.target.checked)}
                />
                Allow an AI check of these included blocks only
              </label>
              <button
                disabled={
                  busy ||
                  !aiConsent ||
                  output !== contextPacket(task, choices) ||
                  !packetIsSafe(task, choices, output)
                }
                onClick={() => void checkAi()}
              >
                {busy ? "Checking…" : "Check task relevance"}
              </button>
              <p className="context-help">
                Edited the preview? Rebuild it before this block-based check.
                The local draft also works without an API.
              </p>
              {aiNote && <p>{aiNote}</p>}
            </details>
            <label className="check context-approval">
              <input
                type="checkbox"
                checked={approved}
                disabled={busy || !output}
                onChange={(e) => setApproved(e.target.checked)}
              />
              <span>
                <strong>I approve this exact context</strong>
                <small>
                  I checked for private details the detector might have missed.
                  Changing the task, blocks or preview requires approval again.
                </small>
              </span>
            </label>
            {approved && !packetIsSafe(task, choices, output) && (
              <p className="context-blocked" role="alert">
                Copy is blocked: remove recognized private details or include at
                least one useful block.
              </p>
            )}
            <div className="context-handoff">
              <label htmlFor="context-destination">
                Your AI
                <select
                  id="context-destination"
                  value={destination}
                  disabled={busy}
                  onChange={(e) => {
                    setDestination(e.target.value as AiDestination);
                    revoke();
                  }}
                >
                  <option>Gemini</option>
                  <option>ChatGPT</option>
                  <option>Claude</option>
                </select>
              </label>
              <button disabled={!safe} onClick={() => void send(false)}>
                <Copy size={15} />
                Copy approved context
              </button>
              <button
                className="primary"
                disabled={!safe}
                onClick={() => void send(true)}
              >
                Open {destination}
                <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="context-boundary">
              <strong>Use a new chat with page access off.</strong>
              <p>
                Paste this packet only. Do not attach the original tab, enable
                native “Ask Gemini” page access, or add connected account
                content if you want this boundary to hold. An extension cannot
                intercept those browser controls.
              </p>
              <p>
                Follow-up questions use this same snapshot. More webpage context
                is collected only when you explicitly add a section. Your chosen
                AI still sees your account and whatever you type in its chat.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
