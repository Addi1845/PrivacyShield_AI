import { sanitize } from "../../../packages/privacy-core";
import { pageFields, pageFieldCandidates } from "./page-fields";
import { classifyField } from "../../../packages/field-core";

type MaskConfig = {
  treatment?: "replace" | "blur" | "hide";
  detected: boolean;
  fields: boolean;
  contacts: boolean;
  avatars: boolean;
  previews: boolean;
};
type MaskReport = {
  treatment: "replace" | "blur" | "hide";
  structuredFields: number;
  fieldTypes: { label: string; count: number }[];
  active: boolean;
  site: "whatsapp" | "generic";
  detectedText: number;
  contactNames: number;
  profileImages: number;
  previews: number;
  fields: number;
  manual: number;
  picking: boolean;
};

declare global {
  interface Window {
    __privacyShield?: {
      version: number;
      stop: () => void;
      rescan: () => void;
      count: () => number;
      configure: (next: Partial<MaskConfig>) => MaskReport;
      report: () => MaskReport;
      pick: () => void;
      cancelPick: () => void;
      undoManual: () => void;
      clearManual: () => void;
      fieldLabels: () => {
        nonce: string;
        fields: { id: string; label: string }[];
      };
      maskAiFields: (
        nonce: string,
        ids: string[],
      ) => { error?: string; report?: MaskReport };
    };
  }
}

if (window.__privacyShield) {
  window.__privacyShield.stop();
} else {
  const isWhatsApp = location.hostname === "web.whatsapp.com";
  let config: MaskConfig = {
    treatment: "replace",
    detected: true,
    fields: true,
    contacts: isWhatsApp,
    avatars: isWhatsApp,
    previews: isWhatsApp,
  };
  const originals = new Map<Text, { raw: string; masked: string }>();
  const textKinds = new Map<Text, "detected" | "contact">();
  const styled = new Map<HTMLElement, string | null>();
  const attributes = new Map<HTMLElement, Map<string, string | null>>();
  type StyleKind =
    | "field"
    | "avatar"
    | "preview"
    | "manual"
    | "structured"
    | "detected"
    | "contact";
  const styleKinds = new Map<HTMLElement, Set<StyleKind>>();
  const strong = new Set<HTMLElement>();
  const structuredLabels = new Map<HTMLElement, string>();
  const manualOrder: HTMLElement[] = [];
  let fieldSnapshot: {
    nonce: string;
    values: Map<string, HTMLElement>;
  } | null = null;
  const aiFields = new Set<HTMLElement>();
  const aliases = new Map<string, string>();
  const visualValues = new Map<string, string>();
  const syntheticNames = [
    "Maya Shah",
    "Aarav Mehta",
    "Riya Kapoor",
    "Kabir Iyer",
    "Anaya Rao",
    "Vihaan Joshi",
  ];
  const observers = new Map<Node, MutationObserver>();
  let picking = false;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hoverTarget: HTMLElement | null = null;
  let hoverOutline = "";
  let hoverOffset = "";

  const allowed = (element: Element) =>
    !element.closest(
      "script,style,noscript,textarea,input,select,[contenteditable]",
    );

  const rememberStyle = (element: HTMLElement, kind: StyleKind) => {
    if (!styled.has(element))
      styled.set(element, element.getAttribute("style"));
    const kinds = styleKinds.get(element) ?? new Set<StyleKind>();
    kinds.add(kind);
    styleKinds.set(element, kinds);
  };

  const conceal = (element: HTMLElement, kind: StyleKind, opaque = false) => {
    rememberStyle(element, kind);
    if (opaque) strong.add(element);
    if (config.treatment === "blur" && !strong.has(element)) {
      element.style.setProperty("filter", "blur(12px)", "important");
      element.style.setProperty("user-select", "none", "important");
      element.style.setProperty("pointer-events", "none", "important");
    } else element.style.setProperty("visibility", "hidden", "important");
  };
  const replaceAttribute = (
    element: HTMLElement,
    name: string,
    value: string,
  ) => {
    if (!attributes.has(element)) attributes.set(element, new Map());
    const saved = attributes.get(element)!;
    if (!saved.has(name)) saved.set(name, element.getAttribute(name));
    element.setAttribute(name, value);
  };
  const restoreAttributes = (element: HTMLElement) => {
    const saved = attributes.get(element);
    if (!saved) return;
    for (const [name, value] of saved)
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    attributes.delete(element);
  };

  const replaceNode = (
    node: Text,
    value: string,
    kind: "detected" | "contact",
  ) => {
    if (!node.data.trim() || originals.has(node)) return;
    const raw = node.data;
    originals.set(node, { raw, masked: value });
    textKinds.set(node, kind);
    node.data = value;
  };

  const aliasFor = (raw: string) => {
    const key = raw.trim().toLocaleLowerCase();
    if (!aliases.has(key))
      aliases.set(
        key,
        syntheticNames[aliases.size % syntheticNames.length] ??
          `Contact ${String(aliases.size + 1).padStart(2, "0")}`,
      );
    return aliases.get(key)!;
  };
  const visualReplacement = (kind: string, key: string) => {
    const mapKey = `${kind}:${key}`;
    if (visualValues.has(mapKey)) return visualValues.get(mapKey)!;
    const index = visualValues.size + 1;
    const value =
      kind === "EMAIL"
        ? `maya.shah${index > 1 ? index : ""}@example.com`
        : kind === "PHONE"
          ? `+91 90000 ${String(12344 + index).padStart(5, "0")}`
          : kind === "PERSON_NAME"
            ? syntheticNames[index % syntheticNames.length]
            : kind === "CUSTOMER_ID"
              ? `CUST-${10481 + index}`
              : kind === "ACCOUNT_ID"
                ? `ACCT-${47290 + index}`
                : kind === "SECRET"
                  ? "••••••••••••"
                  : "Internal note";
    visualValues.set(mapKey, value);
    return value;
  };

  const replaceElementText = (element: HTMLElement) => {
    if (config.treatment !== "replace") {
      conceal(element, "contact");
      return;
    }
    if (element.dataset.privacyshieldAlias) return;
    const raw = (
      element.getAttribute("title") ||
      element.textContent ||
      ""
    ).trim();
    if (!raw || raw.length > 120 || /^\d{1,2}:\d{2}/.test(raw)) return;
    const alias = aliasFor(raw);
    if (element.hasAttribute("title"))
      replaceAttribute(element, "title", alias);
    if (element.hasAttribute("aria-label"))
      replaceAttribute(element, "aria-label", alias);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let first = true;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.data.trim()) continue;
      replaceNode(node, first ? alias : "", "contact");
      first = false;
    }
    if (!first) element.dataset.privacyshieldAlias = "true";
  };

  const scanDetectedText = (root: Document | ShadowRoot) => {
    if (!config.detected) return;
    const groups = new Map<Element, Text[]>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const parent = node.parentElement;
      if (
        !parent ||
        originals.has(node) ||
        !allowed(parent) ||
        !parent.getClientRects().length ||
        getComputedStyle(parent).visibility === "hidden"
      )
        continue;
      const block =
        parent.closest(
          "p,td,th,li,h1,h2,h3,h4,h5,h6,dt,dd,div,section,article",
        ) ?? parent;
      const group = groups.get(block) ?? [];
      group.push(node);
      groups.set(block, group);
    }
    for (const [element, nodes] of groups) {
      const text = nodes.map((node) => node.data).join("");
      if (text.length > 100000) continue;
      let result;
      try {
        result = sanitize(text, false);
      } catch {
        continue;
      }
      if (!result.detections.length) continue;
      if (config.treatment !== "replace" && element instanceof HTMLElement) {
        conceal(
          element,
          "detected",
          result.detections.some((d) => d.kind === "SECRET"),
        );
        continue;
      }
      let offset = 0;
      for (const node of nodes) {
        const raw = node.data;
        const start = offset;
        offset += raw.length;
        let changed = raw;
        for (let index = result.detections.length - 1; index >= 0; index--) {
          const detection = result.detections[index];
          if (detection.start >= offset || detection.end <= start) continue;
          const from = Math.max(0, detection.start - start);
          const to = Math.min(raw.length, detection.end - start);
          changed =
            changed.slice(0, from) +
            (detection.start >= start
              ? visualReplacement(
                  detection.kind,
                  detection.replacement ??
                    text.slice(detection.start, detection.end),
                )
              : "") +
            changed.slice(to);
        }
        if (changed !== raw) replaceNode(node, changed, "detected");
      }
    }
  };

  const scanWhatsApp = (root: Document | ShadowRoot) => {
    if (!isWhatsApp) return;
    if (config.contacts) {
      const selectors = [
        "#pane-side [data-testid='cell-frame-title']",
        "#pane-side span[title]",
        "header [data-testid='conversation-info-header-chat-title']",
        "header span[title]",
      ];
      for (const element of root.querySelectorAll<HTMLElement>(
        selectors.join(","),
      ))
        replaceElementText(element);
    }
    if (config.avatars)
      for (const element of root.querySelectorAll<HTMLElement>(
        "#pane-side img, header img, #pane-side [data-testid='cell-frame-container'] img, #pane-side [data-testid*='avatar'], header [data-testid*='avatar'], #pane-side [style*='background-image'], header [style*='background-image']",
      )) {
        for (const name of ["alt", "title", "aria-label"])
          if (element.hasAttribute(name)) replaceAttribute(element, name, "");
        conceal(element, "avatar");
      }
    if (config.previews)
      for (const element of root.querySelectorAll<HTMLElement>(
        "#pane-side [data-testid='cell-frame-secondary']",
      ))
        conceal(element, "preview");
  };

  const scanRoot = (root: Document | ShadowRoot) => {
    if (config.detected) {
      for (const element of root.querySelectorAll<HTMLElement>(
        "[data-private],[data-context-private]",
      )) {
        structuredLabels.set(element, "Explicitly private region");
        conceal(element, "structured", true);
      }
      const fields = pageFields(root);
      for (const field of fields) {
        structuredLabels.set(field.element, field.label);
        conceal(field.element, "structured", field.category === "SECRET");
      }
      for (const element of aiFields)
        if (element.isConnected) {
          replaceAttribute(element, "data-privacyshield-ai-private", "");
          conceal(element, "structured");
        } else aiFields.delete(element);
      if (config.avatars)
        for (const img of root.querySelectorAll<HTMLElement>("img")) {
          const descriptor = `${img.getAttribute("alt") ?? ""} ${img.getAttribute("class") ?? ""}`;
          const container = img.closest("table,form,main,article") ?? root;
          if (
            /(?:profile|avatar|candidate|passport|signature|photograph)/i.test(
              descriptor,
            ) ||
            (fields.filter((field) => container.contains(field.element))
              .length >= 3 &&
              !/(?:logo|emblem|seal|banner)/i.test(descriptor))
          )
            conceal(img, "avatar");
        }
    }
    scanWhatsApp(root);
    scanDetectedText(root);
    if (config.fields)
      for (const field of root.querySelectorAll<HTMLElement>(
        "input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),textarea,select,[contenteditable]",
      ))
        conceal(field, "field");
    for (const element of root.querySelectorAll("*"))
      if (element.shadowRoot) {
        scanRoot(element.shadowRoot);
        observe(element.shadowRoot);
      }
  };

  const rescan = () => {
    if (!active) return;
    for (const observer of observers.values()) observer.disconnect();
    scanRoot(document);
    for (const [root, observer] of observers)
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
  };

  const observe = (root: Node) => {
    if (observers.has(root)) return;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(rescan, 60);
    });
    observers.set(root, observer);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  const clearHover = () => {
    if (!hoverTarget) return;
    hoverTarget.style.outline = hoverOutline;
    hoverTarget.style.outlineOffset = hoverOffset;
    hoverTarget = null;
  };
  const hover = (event: MouseEvent) => {
    if (!picking) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || target === hoverTarget) return;
    clearHover();
    hoverTarget = target;
    hoverOutline = target.style.outline;
    hoverOffset = target.style.outlineOffset;
    target.style.setProperty("outline", "3px solid #86b81e", "important");
    target.style.setProperty("outline-offset", "2px", "important");
  };
  const pick = (event: MouseEvent) => {
    if (!picking) return;
    const target = event
      .composedPath()
      .find((node) => node instanceof HTMLElement) as HTMLElement | undefined;
    if (!target || target.matches("html,body")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearHover();
    conceal(target, "manual");
    if (!manualOrder.includes(target)) manualOrder.push(target);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      picking = false;
      clearHover();
    }
  };
  const restoreElementKind = (element: HTMLElement, kind: StyleKind) => {
    const kinds = styleKinds.get(element);
    if (!kinds?.delete(kind)) return;
    const style = styled.get(element);
    if (style == null) element.removeAttribute("style");
    else element.setAttribute("style", style);
    if (kinds.size) {
      const first = [...kinds][0];
      conceal(element, first, strong.has(element));
    } else {
      restoreAttributes(element);
      styled.delete(element);
      styleKinds.delete(element);
      strong.delete(element);
    }
  };
  const restoreKind = (kind: StyleKind) => {
    for (const [element, style] of [...styled]) {
      void style;
      restoreElementKind(element, kind);
    }
  };
  const restoreTextKind = (kind: "detected" | "contact") => {
    for (const [node, value] of [...originals]) {
      if (textKinds.get(node) !== kind) continue;
      if (node.isConnected && node.data === value.masked) node.data = value.raw;
      if (node.parentElement) {
        node.parentElement.removeAttribute("data-privacyshield-alias");
        restoreAttributes(node.parentElement);
      }
      originals.delete(node);
      textKinds.delete(node);
    }
    if (kind === "contact") aliases.clear();
    if (kind === "detected") visualValues.clear();
  };
  const report = (): MaskReport => ({
    treatment: config.treatment ?? "replace",
    fieldTypes: [...new Set([...structuredLabels.values()])]
      .map((label) => ({
        label,
        count: [...structuredLabels].filter(
          ([element, value]) =>
            value === label && styleKinds.get(element)?.has("structured"),
        ).length,
      }))
      .filter((field) => field.count),
    structuredFields: [...styleKinds.values()].filter((kinds) =>
      kinds.has("structured"),
    ).length,
    active,
    site: isWhatsApp ? "whatsapp" : "generic",
    detectedText:
      [...textKinds.values()].filter((kind) => kind === "detected").length +
      [...styleKinds.values()].filter((kinds) => kinds.has("detected")).length,
    contactNames:
      [...textKinds.values()].filter((kind) => kind === "contact").length +
      [...styleKinds.values()].filter((kinds) => kinds.has("contact")).length,
    profileImages: [...styleKinds.values()].filter((kinds) =>
      kinds.has("avatar"),
    ).length,
    previews: [...styleKinds.values()].filter((kinds) => kinds.has("preview"))
      .length,
    fields: [...styleKinds.values()].filter((kinds) => kinds.has("field"))
      .length,
    manual: [...styleKinds.values()].filter((kinds) => kinds.has("manual"))
      .length,
    picking,
  });
  const configure = (next: Partial<MaskConfig>) => {
    restoreTextKind("detected");
    restoreTextKind("contact");
    for (const kind of [
      "structured",
      "detected",
      "contact",
      "avatar",
      "preview",
      "field",
    ] as const)
      restoreKind(kind);
    config = { ...config, ...next };
    for (const element of manualOrder) {
      const raw = styled.get(element);
      if (raw == null) element.removeAttribute("style");
      else element.setAttribute("style", raw);
      conceal(element, "manual");
    }
    if (!config.detected) restoreTextKind("detected");
    if (!config.contacts) restoreTextKind("contact");
    if (!config.avatars) restoreKind("avatar");
    if (!config.previews) restoreKind("preview");
    if (!config.fields) restoreKind("field");
    rescan();
    return report();
  };
  const undoManual = () => {
    const element = manualOrder.pop();
    if (element) {
      restoreElementKind(element, "manual");
      rescan();
    }
  };
  const clearManual = () => {
    restoreKind("manual");
    manualOrder.length = 0;
    rescan();
  };
  const fieldLabels = () => {
    const candidates = pageFieldCandidates(document);
    const values = new Map<string, HTMLElement>();
    const fields = candidates.map((field, index) => {
      const id = `f${index}`;
      values.set(id, field.element);
      return {
        id,
        label:
          classifyField(field.label)?.description ??
          sanitize(field.label, true).sanitizedText,
      };
    });
    fieldSnapshot = { nonce: crypto.randomUUID(), values };
    return { nonce: fieldSnapshot.nonce, fields };
  };
  const maskAiFields = (nonce: string, ids: string[]) => {
    if (
      !fieldSnapshot ||
      nonce !== fieldSnapshot.nonce ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !fieldSnapshot!.values.get(id)?.isConnected)
    )
      return {
        error:
          "The page-field review changed or returned invalid IDs. Rescan this page.",
      };
    for (const id of ids) {
      const element = fieldSnapshot.values.get(id)!;
      aiFields.add(element);
      replaceAttribute(element, "data-privacyshield-ai-private", "");
      structuredLabels.set(element, "Additional AI-reviewed field");
      conceal(element, "structured");
    }
    fieldSnapshot = null;
    return { report: report() };
  };
  const stop = () => {
    active = false;
    clearTimeout(timer);
    clearHover();
    for (const observer of observers.values()) observer.disconnect();
    observers.clear();
    document.removeEventListener("click", pick, true);
    document.removeEventListener("mousemove", hover, true);
    document.removeEventListener("keydown", key, true);
    restoreTextKind("detected");
    restoreTextKind("contact");
    restoreKind("field");
    restoreKind("avatar");
    restoreKind("preview");
    restoreKind("manual");
    restoreKind("structured");
    restoreKind("detected");
    restoreKind("contact");
    for (const element of [...attributes.keys()]) restoreAttributes(element);
    delete window.__privacyShield;
  };

  document.addEventListener("click", pick, true);
  document.addEventListener("mousemove", hover, true);
  document.addEventListener("keydown", key, true);
  observe(document);
  rescan();
  window.__privacyShield = {
    version: 2,
    stop,
    rescan,
    count: () => originals.size + styled.size,
    configure,
    report,
    pick: () => {
      picking = true;
    },
    cancelPick: () => {
      picking = false;
      clearHover();
    },
    undoManual,
    clearManual,
    fieldLabels,
    maskAiFields,
  };
}
