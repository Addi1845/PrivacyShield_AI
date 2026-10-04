import {
  parseDecisions,
  safeLabel,
  type SemanticDecision,
} from "../../../packages/semantic-core";
const key = "semanticMeaningsV1";
type Entry = {
  category: SemanticDecision["category"];
  action: SemanticDecision["action"];
  expires: number;
};
// Hash short labels, never persist source values, URLs or page content.
async function labelKey(label: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(label.toLowerCase().replace(/\s+/g, " ").trim()),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function loadMeanings(): Promise<Record<string, Entry>> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return {};
  const stored = (await chrome.storage.local.get(key))[key];
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const result: Record<string, Entry> = {};
  for (const [hash, raw] of Object.entries(stored).slice(-100)) {
    const entry = raw as Entry;
    try {
      if (
        !/^[a-f0-9]{64}$/.test(hash) ||
        !(entry.expires > Date.now()) ||
        !["MASK", "HIDE"].includes(entry.action)
      )
        continue;
      parseDecisions(
        {
          elements: [
            {
              id: "e0",
              category: entry.category,
              action: entry.action,
              confidence: 1,
            },
          ],
        },
        ["e0"],
      );
      result[hash] = entry;
    } catch {
      /* Invalid local cache entries cannot become policy. */
    }
  }
  return result;
}
export async function cachedMeaning(
  label: string,
  cache: Record<string, Entry>,
) {
  return safeLabel(label) ? cache[await labelKey(label)] : undefined;
}
export async function rememberMeaning(
  label: string,
  decision: SemanticDecision,
) {
  if (
    !safeLabel(label) ||
    !["MASK", "HIDE"].includes(decision.action) ||
    typeof chrome === "undefined" ||
    !chrome.storage?.local
  )
    return;
  const cache = await loadMeanings();
  cache[await labelKey(label)] = {
    category: decision.category,
    action: decision.action,
    expires: Date.now() + 30 * 86400000,
  };
  await chrome.storage.local.set({
    [key]: Object.fromEntries(Object.entries(cache).slice(-100)),
  });
}
export async function clearMeanings() {
  if (typeof chrome !== "undefined" && chrome.storage?.local)
    await chrome.storage.local.remove(key);
}
