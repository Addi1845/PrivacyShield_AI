import { useEffect, useRef, useState } from "react";
import {
  categoryLabel,
  confidencePolicy,
  parseDecisions,
  priority,
  validateElements,
  type ReducedCandidate,
  type SemanticDecision,
} from "../../../packages/semantic-core";
import { isExtension } from "./runtime";
export type SemanticSnapshot = {
  nonce: string;
  elements: ReducedCandidate[];
  localCount: number;
};
export function SemanticReview<S extends SemanticSnapshot>({
  prepare,
  apply,
  purpose,
  onNotice,
  allowCache = false,
}: {
  prepare: () => Promise<S>;
  apply: (
    snapshot: S,
    decisions: SemanticDecision[],
    reviewed: string[],
    remember: boolean,
  ) => Promise<void>;
  purpose:
    | "prepare this page for screen sharing"
    | "minimize selected context"
    | "redact local OCR";
  onNotice: (value: string) => void;
  allowCache?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<S | null>(null);
  const [decisions, setDecisions] = useState<SemanticDecision[] | null>(null);
  const [consent, setConsent] = useState(false),
    [remember, setRemember] = useState(false),
    [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]),
    [receipt, setReceipt] = useState("");
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const failure = (error: unknown) => {
    if (!alive.current) return;
    const explanations: Record<string, string> = {
      "Permission unavailable":
        "Allow access to the local AI service when Chrome asks.",
      "HTTP 403":
        "The extension ID does not match the backend configuration. Run node scripts/setup-local.mjs and restart npm run api.",
      "HTTP 400":
        "The request was rejected. Prepare and review a fresh set of labels.",
      "HTTP 429": "The AI request limit was reached. Wait before trying again.",
      "HTTP 503":
        "The backend could not complete the AI check. Check its provider configuration or try again shortly.",
    };
    const detail =
      error instanceof TypeError
        ? "The local AI service cannot be reached. Run npm run api in the project folder and keep it running."
        : error instanceof Error
          ? (explanations[error.message] ??
            (error.name === "TimeoutError"
              ? "The AI check timed out. Try again shortly."
              : "The response could not be validated. Prepare a fresh review and retry."))
          : "Try again shortly.";
    onNotice(
      "Semantic AI scan unavailable. Existing local protection remains active. " +
        detail,
    );
  };
  return (
    <details className="context-ai-check">
      <summary>Semantic privacy scan</summary>
      <p>
        Find unfamiliar private field types. Values stay local. Review the exact
        labels below: a label can itself reveal confidential context. Up to 50
        distinct labels per scan; unsupported content still needs manual
        inspection.
      </p>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setConsent(false);
          setDecisions(null);
          setReceipt("");
          setReviewed([]);
          void prepare()
            .then((next) => {
              if (alive.current) setSnapshot(next);
            })
            .catch((e) => onNotice(e.message))
            .finally(() => {
              if (alive.current) setBusy(false);
            });
        }}
      >
        Prepare semantic review
      </button>
      {snapshot && (
        <>
          <p>
            Local protection matches: {snapshot.localCount}. Reduced label
            candidates: {snapshot.elements.length}.
          </p>
          <ul>
            {snapshot.elements.map((e) => (
              <li key={e.id}>
                {e.id}: {e.label} — value withheld
              </li>
            ))}
          </ul>
          {!snapshot.elements.length && (
            <p>
              No AI request was made: no eligible ambiguous labels were found.
              Local protection still runs. This does not mean all private
              information was detected; use manual masking for missed content.
            </p>
          )}
          {!decisions && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I reviewed these labels and allow only this reduced request to
                the configured AI provider
              </label>
              <button
                disabled={busy || !consent || !snapshot.elements.length}
                onClick={() => {
                  const chosen = snapshot;
                  controller.current = new AbortController();
                  setBusy(true);
                  setConsent(false);
                  void (async () => {
                    if (
                      isExtension &&
                      !(await chrome.permissions.request({
                        origins: ["http://127.0.0.1/*"],
                      }))
                    )
                      throw new Error("Permission unavailable");
                    const body = {
                      consent: true,
                      purpose,
                      elements: chosen.elements,
                    };
                    if (!validateElements(body))
                      throw new Error("Invalid reduced candidates");
                    const response = await fetch(
                      "http://127.0.0.1:4318/classify-elements",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                        signal: AbortSignal.any([
                          controller.current!.signal,
                          AbortSignal.timeout(25000),
                        ]),
                      },
                    );
                    if (!response.ok)
                      throw new Error(`HTTP ${response.status}`);
                    const next = parseDecisions(
                      await response.json(),
                      chosen.elements.map((e) => e.id),
                    );
                    if (alive.current && !controller.current?.signal.aborted)
                      setDecisions(next);
                  })()
                    .catch(failure)
                    .finally(() => {
                      if (alive.current) setBusy(false);
                    });
                }}
              >
                {busy ? "Checking labels…" : "Classify reviewed labels"}
              </button>
            </>
          )}
          {decisions && (
            <>
              <p>
                Review classification before applying. Counts below refer to
                label types, not unique people.
              </p>
              <ul>
                {[...new Set(decisions.map((d) => d.category))].map(
                  (category) => (
                    <li key={category}>
                      {categoryLabel(category)}:{" "}
                      {decisions.filter((d) => d.category === category).length}
                    </li>
                  ),
                )}
              </ul>
              {decisions
                .filter((d) => confidencePolicy(d).action === "REVIEW")
                .map((d) => (
                  <label className="check" key={d.id}>
                    <input
                      type="checkbox"
                      checked={reviewed.includes(d.id)}
                      onChange={(e) =>
                        setReviewed((old) =>
                          e.target.checked
                            ? [...old, d.id]
                            : old.filter((id) => id !== d.id),
                        )
                      }
                    />
                    Protect {d.id}: {categoryLabel(d.category)} —{" "}
                    {d.confidence < 0.65 ? "low confidence" : "needs review"}
                  </label>
                ))}
              {allowCache && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember these protected field meanings locally for 30 days
                </label>
              )}
              <button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void apply(snapshot, decisions, reviewed, remember)
                    .then(() => {
                      if (!alive.current) return;
                      const count = decisions.filter(
                        (d) =>
                          reviewed.includes(d.id) ||
                          priority[confidencePolicy(d).action] >=
                            priority.ALIAS,
                      ).length;
                      setReceipt(
                        `Privacy review: ${snapshot.localCount} local protection matches; ${count} semantic label types protected. External AI received ${snapshot.elements.length} reviewed labels, opaque IDs and withheld-value markers. No raw page, screenshot, form value, page URL, cookies or browser history was included in this semantic request.`,
                      );
                      setSnapshot(null);
                      setDecisions(null);
                      onNotice(
                        "Semantic review applied. Inspect the protected result before sharing.",
                      );
                    })
                    .catch((e) => onNotice(e.message))
                    .finally(() => {
                      if (alive.current) setBusy(false);
                    });
                }}
              >
                Apply reviewed protection
              </button>
            </>
          )}
        </>
      )}
      {receipt && <p role="status">{receipt}</p>}
    </details>
  );
}
