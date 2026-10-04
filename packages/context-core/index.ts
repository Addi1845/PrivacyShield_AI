import { detect, sanitize, validateOutput } from "../privacy-core";
import { localDecision, priority } from "../semantic-core";
import { classifyField } from "../field-core";

export type ContextBlock = {
  id: string;
  text: string;
  section?: string;
  heading?: boolean;
  fieldLabel?: string;
  semanticPrivate?: boolean;
};
export type ContextCapture = {
  blocks: ContextBlock[];
  omitted: number;
  source:
    "selection" | "section" | "element" | "area" | "page" | "main" | "paste";
};
export type ContextChoice = ContextBlock & {
  cleaned: string;
  included: boolean;
  locked: boolean;
  reason: string;
  replacements: number;
};

// Entire identity/account fields are unnecessary for the supported context handoff.
// These are conservative suggestions, not a semantic privacy guarantee.
const identityField =
  /(?:^|\n)\s*(?:name|customer|patient|contact|e-?mail|phone|mobile|billing|shipping|delivery address|address|account|order id|purchase history|browsing history|recently viewed|signed in|logged in|welcome back|payment|card number|password|api[_ -]?key|authorization|confidential|private|ssn|aadhaar)\s*[:#=]|\b(?:your account|your orders|your cart|shopping cart|saved addresses)\b/i;
const chromeText =
  /^(?:home|menu|navigation|sign in|log in|sign out|log out|my account|my orders|cart|checkout|cookie preferences|accept cookies|privacy policy|terms and conditions)$/i;
const stopWords = new Set(
  "a an the to of for in on at is are was be been i me my you your please help with and or it this that these those what which how why can could should would do does need want tell give explain compare comparison summarize summary difference differences better best two options option between about only using use according task details detail".split(
    " ",
  ),
);
const tokens = (value: string) =>
  (value.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? [])
    .filter((word) => !stopWords.has(word) && !/^\d+$/.test(word))
    .map((word) =>
      word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word,
    );

export function pasteCapture(text: string): ContextCapture {
  if (!text.trim() || text.length > 30000)
    throw new Error(
      "Paste a relevant excerpt between 1 and 30,000 characters.",
    );
  const blocks = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (blocks.length > 120)
    throw new Error("Choose a smaller excerpt (up to 120 lines).");
  return {
    blocks: blocks.map((text, index) => ({ id: `b${index}`, text })),
    omitted: 0,
    source: "paste",
  };
}

export function prepareChoices(
  capture: ContextCapture,
  task: string,
): ContextChoice[] {
  const interests = tokens(sanitize(task, true).sanitizedText);
  const matches = capture.blocks.map((block) => {
    const blockWords = new Set(
      tokens(`${block.fieldLabel ?? ""} ${block.text}`),
    );
    return interests.some((word) => blockWords.has(word));
  });
  const hasMatches = matches.some(Boolean);
  const relevance = capture.blocks.map(
    (block, index) =>
      !hasMatches ||
      matches[index] ||
      (/\b(?:compare|comparison|choose|recommend|buy|laptop|product)\b/i.test(
        task,
      ) &&
        /(?:[₹$€£]|\b(?:price|ram|storage|battery|processor|warranty|display|screen|weight|ssd|gb|tb|shipping cost)\b)/i.test(
          block.text,
        )),
  );
  return capture.blocks.map((block, index) => {
    const result = sanitize(block.text, true);
    const semantic = localDecision({
      id: "e0",
      text: block.text,
      label: block.fieldLabel,
    });
    const locked =
      block.semanticPrivate === true ||
      (Boolean(block.fieldLabel) &&
        priority[semantic.action] >= priority.MASK) ||
      semantic.category === "CONFIDENTIAL_WORK" ||
      Boolean(block.fieldLabel && classifyField(block.fieldLabel)) ||
      identityField.test(block.text) ||
      chromeText.test(block.text) ||
      result.detections.some(
        (d) => d.kind === "SECRET" || d.kind === "UNKNOWN",
      );
    // A useful task-dependent initial suggestion. Users can include other public facts.
    const relevant =
      relevance[index] ||
      (block.heading &&
        block.section &&
        capture.blocks.some(
          (other, otherIndex) =>
            other.section === block.section &&
            !other.heading &&
            !identityField.test(other.text) &&
            relevance[otherIndex],
        ));
    const field = block.fieldLabel ? classifyField(block.fieldLabel) : null;
    const privateReason = field
      ? `${field.description} — excluded because of the associated page label.`
      : result.detections.some((d) => d.kind === "SECRET")
        ? "Credential — excluded from every handoff."
        : /(?:address|shipping|billing)/i.test(block.text)
          ? "Address or delivery field — not needed for this handoff."
          : /(?:email|contact|phone|mobile)/i.test(block.text)
            ? "Contact field — reduces direct identity exposure when excluded."
            : /(?:history|cart|orders)/i.test(block.text)
              ? "Account activity — avoids sharing unrelated behavior."
              : "Identity, navigation or sensitive field — excluded from this handoff.";
    return {
      ...block,
      cleaned: result.sanitizedText,
      locked,
      included: !locked && Boolean(relevant),
      replacements: result.detections.length,
      reason: locked
        ? privateReason
        : !relevant
          ? "No direct match to your question. Include it only if needed."
          : result.detections.length
            ? "Useful context; recognized identifiers replaced locally."
            : hasMatches
              ? "Matches your task or supplies comparison facts."
              : "From your chosen scope; check whether your task needs it.",
    };
  });
}

export function contextPacket(task: string, choices: ContextChoice[]) {
  const question = sanitize(task.trim(), true).sanitizedText;
  const body = choices
    .filter((b) => b.included && !b.locked)
    .map((b) => b.cleaned)
    .join("\n");
  return question && body
    ? `Task: ${question}\n\nApproved page context:\n${body}`
    : "";
}

export function packetIsSafe(
  task: string,
  choices: ContextChoice[],
  packet: string,
) {
  if (
    !task.trim() ||
    !packet.trim() ||
    packet.length > 30000 ||
    !choices.some((b) => b.included && !b.locked)
  )
    return false;
  const original = [task, ...choices.map((b) => b.text)].join("\n");
  if (original.length > 100000 || !validateOutput(original, packet))
    return false;
  return !choices.some(
    (b) =>
      b.locked &&
      b.text.length > 3 &&
      packet.toLowerCase().includes(b.text.toLowerCase()),
  );
}

// An AI processor may remove blocks, never rewrite facts or introduce page content.
export function applyAiSubset(
  choices: ContextChoice[],
  keepIds: unknown,
): ContextChoice[] {
  if (
    !Array.isArray(keepIds) ||
    !keepIds.length ||
    keepIds.length > choices.length ||
    keepIds.some(
      (id) =>
        typeof id !== "string" ||
        !choices.some((b) => b.id === id && b.included && !b.locked),
    ) ||
    new Set(keepIds).size !== keepIds.length
  )
    throw new Error(
      "The AI check returned an invalid selection. Your draft was kept.",
    );
  const keep = new Set(keepIds);
  return choices.map((b) => ({
    ...b,
    included: b.included && keep.has(b.id),
    reason:
      b.included && !keep.has(b.id)
        ? "AI marked this as unnecessary for the task. You can include it again."
        : b.reason,
  }));
}

export function recognizedRiskCount(task: string, choices: ContextChoice[]) {
  return (
    detect(task).length + choices.reduce((sum, b) => sum + b.replacements, 0)
  );
}

export const shoppingSample =
  "Laptop A: 16 GB RAM, 512 GB SSD, ₹52,000, 8-hour battery.\nLaptop B: 32 GB RAM, 1 TB SSD, ₹67,000, 10-hour battery.\nName: Priya Sharma\nEmail: priya@example.com\nShipping: 42 Private Road, Pune\nYour cart\napi_key: demo_sensitive_token_1234567890";
