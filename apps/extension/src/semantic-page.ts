import {
  localDecision,
  safeLabel,
  reduceCandidate,
  type SemanticCandidate,
  type ReducedCandidate,
} from "../../../packages/semantic-core";
import { classifyField } from "../../../packages/field-core";

const excluded =
  "script,style,noscript,iframe,canvas,video,svg,input,textarea,select,[contenteditable],[hidden],[aria-hidden=true],nav,[role=navigation],#privacyshield-banner,[data-privacyshield-ui]";
const text = (el: Element | null) =>
  el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
export function visible(element: HTMLElement) {
  if (element.closest(excluded) || !element.getClientRects().length)
    return false;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    )
      return false;
  }
  return true;
}
export function semanticLabel(element: HTMLElement): string {
  const root = element.getRootNode() as Document | ShadowRoot;
  const labelText = (node: Element | null) => {
    if (
      !(node instanceof HTMLElement) ||
      !visible(node) ||
      node.querySelector("input,textarea,select")
    )
      return "";
    const value = text(node).replace(/[.:：]\s*$/, "");
    return value.length <= 120 && safeLabel(value) ? value : "";
  };
  const labelLike = (node: Element) =>
    node.matches("label,b,strong,dt,[data-field-label],[role=rowheader]") ||
    /(?:^|[-_\s])(label|caption)(?:$|[-_\s])/i.test(node.className) ||
    !!classifyField(text(node));
  for (let depth = 0; depth < 4; depth++) {
    const labelled = element.getAttribute("aria-labelledby");
    if (labelled) {
      const value = labelled
        .split(/\s+/)
        .map((id) => labelText(root.getElementById(id)))
        .join(" ");
      if (value.trim() && value.length <= 120) return value.trim();
    }
    const aria = element.getAttribute("aria-label");
    if (aria && aria.length <= 120) return aria;
    let prior = element.previousElementSibling;
    while (
      prior &&
      (prior.matches("br,svg,[aria-hidden=true]") || !text(prior))
    )
      prior = prior.previousElementSibling;
    const siblings = [...(element.parentElement?.children ?? [])].filter(
      (node) => !node.matches("br,svg,[aria-hidden=true]") && text(node),
    );
    // Separators, help icons and extra grid fields must not break a label/value pair.
    if (
      prior &&
      (element.matches("td,dd,[role=cell]") ||
        siblings.length === 2 ||
        labelLike(prior))
    ) {
      const label = labelText(prior);
      if (label) return label;
    }
    // A common field is <div><strong>Label</strong><br>raw value</div>.
    // Cover that bounded field container when the value has no element of its own.
    const children = [...element.children].filter(
      (node) => !node.matches("br,svg,[aria-hidden=true]") && text(node),
    );
    if (
      children.length &&
      children.length <= 3 &&
      labelLike(children[0]) &&
      children.filter(labelLike).length === 1 &&
      text(element).length <= 300
    ) {
      const label = labelText(children[0]);
      if (
        label &&
        text(element).length > text(children[0]).length &&
        [...element.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        )
      )
        return label;
    }
    const parent = element.parentElement;
    if (
      !parent ||
      parent.matches("main,article,section,body,html") ||
      [...parent.children].filter(
        (node) => !node.matches("br,svg,[aria-hidden=true]") && text(node),
      ).length !== 1
    )
      break;
    element = parent;
  }
  return "";
}
export type PageCandidate = {
  candidate: SemanticCandidate;
  element: HTMLElement;
  fingerprint: string;
};
export function pageFingerprint(element: HTMLElement) {
  return `${text(element)}\n${semanticLabel(element)}`;
}
export function extractSemanticPage(
  root: Document | ShadowRoot,
): PageCandidate[] {
  const result: PageCandidate[] = [];
  const seen = new Set<HTMLElement>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let examined = 0;
  while (walker.nextNode() && examined++ < 10000 && result.length < 500) {
    const leaf = walker.currentNode.parentElement;
    if (!leaf || !walker.currentNode.textContent?.trim()) continue;
    const element =
      leaf.closest<HTMLElement>("td,dd,[role=cell],[data-field-value]") ?? leaf;
    if (seen.has(element) || !visible(element)) continue;
    seen.add(element);
    const value = text(element);
    if (
      !value ||
      value.length > 300 ||
      element.matches("html,body,button") ||
      (element.matches("a") && !semanticLabel(element))
    )
      continue;
    result.push({
      element,
      fingerprint: pageFingerprint(element),
      candidate: {
        id: `e${result.length}`,
        text: value,
        label: semanticLabel(element),
        elementType: element.tagName.toLowerCase(),
      },
    });
  }
  return result;
}
export function reducedPageBatch(entries: PageCandidate[]) {
  const groups = new Map<string, PageCandidate[]>();
  const elements: ReducedCandidate[] = [];
  for (const entry of entries) {
    if (localDecision(entry.candidate).action !== "REVIEW") continue;
    const reduced = reduceCandidate(entry.candidate);
    if (!reduced) continue;
    const key = reduced.label.toLowerCase();
    const existing = elements.find((e) => e.label.toLowerCase() === key);
    if (existing) {
      groups.get(existing.id)!.push(entry);
      continue;
    }
    if (elements.length >= 50) continue;
    const id = `e${elements.length}`;
    elements.push({ ...reduced, id });
    groups.set(id, [entry]);
  }
  return { elements, groups };
}
