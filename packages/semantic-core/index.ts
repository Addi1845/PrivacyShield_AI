import { detect } from "../privacy-core";
import { classifyField, type FieldCategory } from "../field-core";
import { safeLabel } from "./schema.mjs";
export {
  parseDecisions,
  validId,
  validateElements,
  safeLabel,
} from "./schema.mjs";
export type SemanticCategory =
  | "PUBLIC_CONTENT"
  | "PERSON_NAME"
  | "CONTACT"
  | "ADDRESS"
  | "PERSONAL_IDENTIFIER"
  | "FINANCIAL"
  | "HEALTH"
  | "DEMOGRAPHIC"
  | "AUTH_SECRET"
  | "PRIVATE_CONVERSATION"
  | "ACCOUNT_ACTIVITY"
  | "INTERNAL_PROJECT"
  | "CONFIDENTIAL_WORK"
  | "CUSTOMER_INFORMATION"
  | "PERSONAL_RELATIONSHIP"
  | "LOCATION_CONTEXT"
  | "UNKNOWN_PRIVATE";
export type SemanticAction = "ALLOW" | "ALIAS" | "MASK" | "HIDE" | "REVIEW";
export type SemanticCandidate = {
  id: string;
  text: string;
  label?: string;
  nearbyText?: string;
  heading?: string;
  role?: string;
  elementType?: string;
};
export type SemanticDecision = {
  id: string;
  category: SemanticCategory;
  action: SemanticAction;
  confidence: number;
  reason?: string;
};
export type ReducedCandidate = {
  id: string;
  text: "[VALUE_WITHHELD]";
  label: string;
};
export const priority: Record<SemanticAction, number> = {
  ALLOW: 0,
  REVIEW: 1,
  ALIAS: 2,
  MASK: 3,
  HIDE: 4,
};
const fieldCategories: Record<FieldCategory, SemanticCategory> = {
  NAME: "PERSON_NAME",
  BIRTH: "PERSONAL_IDENTIFIER",
  IDENTIFIER: "PERSONAL_IDENTIFIER",
  DEMOGRAPHIC: "DEMOGRAPHIC",
  FINANCIAL: "FINANCIAL",
  ADDRESS: "ADDRESS",
  CONTACT: "CONTACT",
  SECRET: "AUTH_SECRET",
  IMAGE: "PERSONAL_IDENTIFIER",
};
export function localDecision(c: SemanticCandidate): SemanticDecision {
  const detections = detect(c.text);
  const field = c.label ? classifyField(c.label) : null;
  let category: SemanticCategory = "PUBLIC_CONTENT",
    action: SemanticAction = "ALLOW";
  if (field) category = fieldCategories[field.category];
  if (detections.length && category === "PUBLIC_CONTENT")
    category = "UNKNOWN_PRIVATE";
  if (
    detections.some((d) => d.kind === "SECRET") ||
    field?.category === "SECRET"
  )
    category = "AUTH_SECRET";
  if (
    category === "PUBLIC_CONTENT" &&
    /\b(?:confidential|internal (?:project|review|department)|project .{1,40} internal|private conversation)\b/i.test(
      c.text,
    )
  )
    category = "CONFIDENTIAL_WORK";
  if (category !== "PUBLIC_CONTENT")
    action = category === "AUTH_SECRET" ? "HIDE" : "MASK";
  else if (
    c.label &&
    !/^(?:price|ram|storage|weight|battery|processor|display|warranty|product|model|color|colour|size|dimensions)$/i.test(
      c.label.trim(),
    )
  )
    action = "REVIEW";
  return {
    id: c.id,
    category,
    action,
    confidence: action === "REVIEW" ? 0 : 1,
  };
}
export function confidencePolicy(d: SemanticDecision): SemanticDecision {
  if (d.category === "AUTH_SECRET") return { ...d, action: "HIDE" };
  if (d.confidence < 0.9) return { ...d, action: "REVIEW" };
  if (d.category !== "PUBLIC_CONTENT" && d.action === "ALLOW")
    return { ...d, action: "REVIEW" };
  return d;
}
export function mergeDecisions(
  local: SemanticDecision,
  ai?: SemanticDecision,
): SemanticDecision {
  const hard =
    local.category === "AUTH_SECRET"
      ? { ...local, action: "HIDE" as const }
      : local;
  if (!ai || ai.id !== local.id) return hard;
  const proposed = confidencePolicy(ai);
  return priority[hard.action] >= priority[proposed.action] ? hard : proposed;
}
export function reduceCandidate(c: SemanticCandidate): ReducedCandidate | null {
  if (localDecision(c).action !== "REVIEW") return null;
  const label = c.label
    ?.replace(/\s+/g, " ")
    .trim()
    .replace(/[:：]\s*$/, "");
  if (!label || !safeLabel(label) || detect(label).length) return null;
  return { id: c.id, text: "[VALUE_WITHHELD]", label };
}
export function categoryLabel(category: SemanticCategory) {
  return category.toLowerCase().replaceAll("_", " ");
}
