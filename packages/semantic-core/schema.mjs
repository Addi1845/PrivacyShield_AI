export const categories = [
  "PUBLIC_CONTENT",
  "PERSON_NAME",
  "CONTACT",
  "ADDRESS",
  "PERSONAL_IDENTIFIER",
  "FINANCIAL",
  "HEALTH",
  "DEMOGRAPHIC",
  "AUTH_SECRET",
  "PRIVATE_CONVERSATION",
  "ACCOUNT_ACTIVITY",
  "INTERNAL_PROJECT",
  "CONFIDENTIAL_WORK",
  "CUSTOMER_INFORMATION",
  "PERSONAL_RELATIONSHIP",
  "LOCATION_CONTEXT",
  "UNKNOWN_PRIVATE",
];
export const actions = ["ALLOW", "ALIAS", "MASK", "HIDE", "REVIEW"];
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const keys = (x, allowed) =>
  object(x) && Object.keys(x).every((k) => allowed.includes(k));
export const validId = (id) =>
  typeof id === "string" && /^e(?:0|[1-9]\d{0,2})$/.test(id);
// Only short label phrases are eligible. No values, markup, URLs or numbers.
// This is an input restriction, not a claim that all labels are non-private.
export const safeLabel = (label) =>
  typeof label === "string" &&
  label.trim().length > 1 &&
  label.length <= 120 &&
  /^[\p{L}\p{M}\s()'’/_-]+$/u.test(label) &&
  !/\b(?:bearer\b|BEGIN\b|gsk_|sk-|gh[pousr]_|github_pat_|xox[baprs]-)/i.test(
    label,
  );
export function validateElements(body) {
  return (
    keys(body, ["consent", "purpose", "elements"]) &&
    body.consent === true &&
    [
      "prepare this page for screen sharing",
      "minimize selected context",
      "redact local OCR",
    ].includes(body.purpose) &&
    Array.isArray(body.elements) &&
    body.elements.length > 0 &&
    body.elements.length <= 50 &&
    body.elements.every(
      (e) =>
        keys(e, ["id", "text", "label"]) &&
        validId(e.id) &&
        e.text === "[VALUE_WITHHELD]" &&
        safeLabel(e.label),
    ) &&
    new Set(body.elements.map((e) => e.id)).size === body.elements.length
  );
}
export function parseDecisions(payload, ids) {
  if (
    !Array.isArray(ids) ||
    ids.some((id) => !validId(id)) ||
    new Set(ids).size !== ids.length ||
    !keys(payload, ["elements"]) ||
    !Array.isArray(payload.elements) ||
    payload.elements.length !== ids.length
  )
    throw new Error("Invalid semantic response");
  const seen = new Set();
  for (const d of payload.elements) {
    if (
      !keys(d, ["id", "category", "action", "confidence", "reason"]) ||
      !ids.includes(d.id) ||
      seen.has(d.id) ||
      !categories.includes(d.category) ||
      !actions.includes(d.action) ||
      typeof d.confidence !== "number" ||
      !Number.isFinite(d.confidence) ||
      d.confidence < 0 ||
      d.confidence > 1 ||
      (d.reason !== undefined &&
        (typeof d.reason !== "string" || d.reason.length > 200))
    )
      throw new Error("Invalid semantic decision");
    seen.add(d.id);
  }
  // Discard model prose. Never display or persist untrusted explanations.
  return payload.elements.map(({ id, category, action, confidence }) => ({
    id,
    category,
    action: category === "AUTH_SECRET" ? "HIDE" : action,
    confidence,
  }));
}
