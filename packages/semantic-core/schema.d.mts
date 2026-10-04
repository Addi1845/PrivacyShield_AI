import type { SemanticDecision } from "./index";
export const categories: readonly string[];
export const actions: readonly string[];
export function validId(id: unknown): boolean;
export function safeLabel(label: unknown): boolean;
export function validateElements(body: unknown): boolean;
export function parseDecisions(
  payload: unknown,
  ids: string[],
): SemanticDecision[];
