import { useState, useEffect, useRef } from "react";
import { getFieldLabels, applyAiFields, isExtension } from "./runtime";
import type { MaskReport } from "./runtime";
export function FieldReview({
  onNotice,
  onReport,
}: {
  onNotice: (value: string) => void;
  onReport: (report: MaskReport) => void;
}) {
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof getFieldLabels>
  > | null>(null);
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <details className="context-ai-check">
      <summary>AI review of this page’s field types</summary>
      <p>
        Local scanning already protects recognized fields. An optional AI check
        can identify additional private fields from their labels. Values,
        photos, screenshots and page URLs are never part of this request.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void getFieldLabels()
            .then((next) => {
              setSnapshot(next);
              setConsent(false);
            })
            .catch((error) => onNotice(error.message))
        }
      >
        Read field labels for review
      </button>
      {snapshot && (
        <>
          <p className="context-help">
            These are the exact labels the configured processor (Groq) will
            receive. Labels themselves can carry confidential context; inspect
            them first.
          </p>
          <ul>
            {snapshot.fields.map((field) => (
              <li key={field.id}>{field.label}</li>
            ))}
          </ul>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(event) => setConsent(event.target.checked)}
            />
            Allow AI to classify these field labels only
          </label>
          <button
            disabled={!consent || busy || !snapshot.fields.length}
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
                  throw new Error("AI processing access was not granted.");
                const response = await fetch(
                  "http://127.0.0.1:4318/classify-fields",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      consent: true,
                      fields: chosen.fields,
                    }),
                    signal: AbortSignal.any([
                      controller.current!.signal,
                      AbortSignal.timeout(30000),
                    ]),
                  },
                );
                const result = await response.json();
                if (!response.ok)
                  throw new Error(
                    result.error ?? "AI field check unavailable.",
                  );
                if (
                  !Array.isArray(result.privateIds) ||
                  new Set(result.privateIds).size !==
                    result.privateIds.length ||
                  result.privateIds.some(
                    (id: unknown) =>
                      typeof id !== "string" ||
                      !chosen.fields.some((field) => field.id === id),
                  )
                )
                  throw new Error(
                    "AI returned invalid fields. Existing protection was kept.",
                  );
                if (!alive.current || controller.current?.signal.aborted)
                  return;
                onReport(
                  await applyAiFields(
                    chosen.tabId,
                    chosen.nonce,
                    result.privateIds,
                  ),
                );
                setSnapshot(null);
                onNotice(
                  `${result.privateIds.length} field types marked private by AI. Existing local masks remain; inspect the page before sharing.`,
                );
              })()
                .catch((error) => {
                  if (alive.current) onNotice(error.message);
                })
                .finally(() => {
                  if (alive.current) setBusy(false);
                });
            }}
          >
            {busy ? "Checking labels…" : "Check field privacy with AI"}
          </button>
        </>
      )}
    </details>
  );
}
