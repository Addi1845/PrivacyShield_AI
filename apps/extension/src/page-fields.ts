import {
  classifyField,
  type FieldCategory,
} from "../../../packages/field-core";
import { extractSemanticPage } from "./semantic-page";
export type PageField = {
  element: HTMLElement;
  category: FieldCategory;
  label: string;
};
export function pageFieldCandidates(root: Document | ShadowRoot) {
  const candidates: { element: HTMLElement; label: string }[] = [];
  for (const row of root.querySelectorAll("tr")) {
    const cells = [...row.children].filter((cell) => cell.matches("td,th"));
    for (let index = 0; index + 1 < cells.length; index += 2) {
      const label = cells[index].textContent?.replace(/\s+/g, " ").trim() ?? "";
      const value = cells[index + 1];
      if (
        label &&
        label.length <= 160 &&
        value instanceof HTMLElement &&
        value.getClientRects().length
      )
        candidates.push({ element: value, label });
    }
  }
  return candidates.slice(0, 80);
}
export function pageFields(root: Document | ShadowRoot): PageField[] {
  const fields = new Map<HTMLElement, PageField>();
  for (const label of root.querySelectorAll<HTMLElement>(
    "td,th,dt,label,[data-field-label],[role=rowheader]",
  )) {
    const rule = classifyField(
      label.dataset.fieldLabel ?? label.textContent?.trim() ?? "",
    );
    if (
      !rule ||
      !label.getClientRects().length ||
      getComputedStyle(label).visibility === "hidden"
    )
      continue;
    const value =
      label instanceof HTMLLabelElement && label.htmlFor
        ? root.querySelector<HTMLElement>(`[id="${CSS.escape(label.htmlFor)}"]`)
        : (label.querySelector<HTMLElement>("[data-field-value]") ??
          label.nextElementSibling);
    if (
      !(value instanceof HTMLElement) ||
      !value.getClientRects().length ||
      value.matches("script,style,button,th")
    )
      continue;
    fields.set(value, {
      element: value,
      category: rule.category,
      label: rule.description,
    });
  }
  for (const { candidate, element } of extractSemanticPage(root)) {
    const rule = classifyField(candidate.label ?? "");
    if (rule)
      fields.set(element, {
        element,
        category: rule.category,
        label: rule.description,
      });
  }
  return [...fields.values()];
}
