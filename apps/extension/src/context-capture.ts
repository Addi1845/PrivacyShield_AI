import type { ContextCapture } from "../../../packages/context-core";
import { currentTab } from "./runtime";

// This function is serialized into the isolated scripting world. Keep every DOM
// helper inside it: no imported functions or captured module variables.
export async function captureContext(
  mode: "selection" | "section" | "element" | "area" | "page" | "main",
): Promise<{ capture?: ContextCapture; error?: string }> {
  const run = async (): Promise<ContextCapture> => {
    const excludedSelector =
      "script,style,noscript,nav,aside,header,footer,[role=navigation],[role=banner],[role=complementary],input,textarea,select,[contenteditable],form,[hidden],[aria-hidden=true],iframe,canvas,video,#privacyshield-context-picker,#privacyshield-banner,[data-private],[data-context-private],[data-privacyshield-ai-private],[autocomplete],[id*=account i],[class*=account-menu i],[id*=cart i],[class*=shopping-cart i],[id*=billing i],[id*=shipping-address i],[id*=purchase-history i]";
    const explicit =
      mode === "selection" ||
      mode === "section" ||
      mode === "element" ||
      mode === "area";
    const basicExclusions =
      "script,style,noscript,input,textarea,select,[hidden],[aria-hidden=true],iframe,canvas,video,#privacyshield-context-picker,#privacyshield-banner";
    const allowed = (el: Element) => {
      if (
        el.closest(
          explicit ? basicExclusions : excludedSelector.replace(",form,", ","),
        ) ||
        !el.getClientRects().length
      )
        return false;
      // An ancestor with opacity:0 can still have client rects.
      for (let p: Element | null = el; p; p = p.parentElement) {
        const style = getComputedStyle(p);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        )
          return false;
      }
      return true;
    };
    const collect = (
      root: Element,
      range?: Range,
      area?: { left: number; top: number; right: number; bottom: number },
    ): ContextCapture => {
      const groups = new Map<Element, string[]>();
      let omitted = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (
          !parent ||
          !node.textContent?.trim() ||
          (range && !range.intersectsNode(node))
        )
          continue;
        if (!allowed(parent)) {
          omitted++;
          continue;
        }
        if (area) {
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);
          const rect = nodeRange.getBoundingClientRect();
          if (
            rect.right < area.left ||
            rect.left > area.right ||
            rect.bottom < area.top ||
            rect.top > area.bottom
          )
            continue;
        }
        let value = node.textContent;
        if (area) {
          const selected: string[] = [];
          const letter = document.createRange();
          for (let offset = 0; offset < value.length; offset++) {
            letter.setStart(node, offset);
            letter.setEnd(node, offset + 1);
            const r = letter.getBoundingClientRect();
            if (
              (r.left + r.right) / 2 >= area.left &&
              (r.left + r.right) / 2 <= area.right &&
              (r.top + r.bottom) / 2 >= area.top &&
              (r.top + r.bottom) / 2 <= area.bottom
            )
              selected.push(value[offset]);
          }
          value = selected.join("");
          if (!value.trim()) continue;
        }
        if (range) {
          const start = node === range.startContainer ? range.startOffset : 0;
          const end =
            node === range.endContainer ? range.endOffset : value.length;
          value = value.slice(start, end);
        }
        const cell = parent.closest("td,th,dd,[role=cell]");
        const group =
          cell ??
          parent.closest(
            "p,li,tr,dt,dd,h1,h2,h3,h4,h5,h6,pre,blockquote,[data-context-block]",
          ) ??
          parent;
        const current = groups.get(group) ?? [];
        current.push(value);
        groups.set(group, current);
      }
      const sections = new Map<Element, string>();
      const entries = [...groups.entries()]
        .map(([element, values]) => {
          const ancestor =
            element.closest(
              "article,section,[data-context-section],[itemtype$='/Product'],[data-product-id]",
            ) ?? root;
          if (!sections.has(ancestor))
            sections.set(ancestor, `s${sections.size}`);
          return {
            text: values.join(" ").replace(/\s+/g, " ").trim(),
            section: sections.get(ancestor),
            heading: /^H[1-6]$/.test(element.tagName),
            fieldLabel: element.closest(
              "[data-private],[data-context-private],[data-privacyshield-ai-private]",
            )
              ? "Private field"
              : element.matches("td,th,dd,[role=cell]")
                ? (element.previousElementSibling?.textContent ?? "")
                    .trim()
                    .slice(0, 350)
                : undefined,
          };
        })
        .filter((entry) => entry.text);
      const lines = entries.map((entry) => entry.text);
      if (!lines.length)
        throw new Error(
          "No readable content in that scope. Choose a public text section or paste a relevant excerpt.",
        );
      if (lines.length > 120 || lines.join("\n").length > 30000)
        throw new Error(
          "That scope is too large. Choose a smaller section (up to 120 blocks / 30,000 characters).",
        );
      return {
        blocks: entries.map((entry, index) => ({ id: `b${index}`, ...entry })),
        omitted,
        source: mode,
      };
    };
    if (mode === "selection") {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount)
        throw new Error(
          "Highlight the exact text on the webpage first. Nothing else was collected.",
        );
      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const root = node instanceof Element ? node : node.parentElement;
      if (!root) throw new Error("Select a readable text section first.");
      return collect(root, range);
    }
    if (mode === "main") {
      const roots = [...document.querySelectorAll("main,[role=main]")].filter(
        allowed,
      );
      const articles = [...document.querySelectorAll("article")].filter(
        allowed,
      );
      const root =
        roots.length === 1
          ? roots[0]
          : !roots.length && articles.length === 1
            ? articles[0]
            : null;
      if (!root)
        throw new Error(
          "This page has no unambiguous main content. Choose a section instead; the whole page will not be collected.",
        );
      return collect(root);
    }
    if (mode === "page") return collect(document.body);
    document.dispatchEvent(new Event("privacyshield-cancel-context-pick"));
    return new Promise((resolve, reject) => {
      const host = document.createElement("div");
      host.id = "privacyshield-context-picker";
      const shadow = host.attachShadow({ mode: "closed" });
      const caption = document.createElement("div");
      caption.textContent =
        mode === "area"
          ? "PrivacyShield · Drag a rectangle around the text you want AI to use. Esc cancels."
          : "PrivacyShield · Click the outlined element you want AI to use. Esc cancels.";
      caption.style.cssText =
        "position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:12px 18px;background:#14261e;color:#fff;font:14px system-ui;border-radius:6px;max-width:80vw;box-shadow:0 2px 12px #0003";
      const outline = document.createElement("div");
      outline.style.cssText =
        "position:fixed;border:2px solid #227750;background:#22775014;box-sizing:border-box;display:none";
      host.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
      shadow.append(caption, outline);
      document.documentElement.append(host);
      const sectionAt = (target: EventTarget | null) => {
        if (!(target instanceof Element) || !allowed(target)) return null;
        const section =
          mode === "element"
            ? target
            : (target.closest(
                "[data-context-section],article,section,[itemtype$='/Product'],[data-product-id]",
              ) ??
              target.closest(
                "td,th,p,li,tr,pre,blockquote,h1,h2,h3,div,span,a,button",
              ));
        return section && allowed(section) && !section.matches("body,html,main")
          ? section
          : null;
      };
      const cleanup = () => {
        host.remove();
        clearTimeout(timer);
        document.removeEventListener("pointermove", hover, true);
        document.removeEventListener("click", click, true);
        document.removeEventListener("keydown", key, true);
        document.removeEventListener("pointerdown", down, true);
        document.removeEventListener("pointerup", up, true);
        document.removeEventListener(
          "privacyshield-cancel-context-pick",
          cancel,
        );
      };
      let anchor: { x: number; y: number } | null = null;
      const areaAt = (x: number, y: number) => ({
        left: Math.min(anchor!.x, x),
        top: Math.min(anchor!.y, y),
        right: Math.max(anchor!.x, x),
        bottom: Math.max(anchor!.y, y),
      });
      const drawArea = (rect: {
        left: number;
        top: number;
        right: number;
        bottom: number;
      }) =>
        Object.assign(outline.style, {
          display: "block",
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.right - rect.left}px`,
          height: `${rect.bottom - rect.top}px`,
        });
      const down = (event: PointerEvent) => {
        if (mode !== "area") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        anchor = { x: event.clientX, y: event.clientY };
      };
      const up = (event: PointerEvent) => {
        if (mode !== "area" || !anchor) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const rect = areaAt(event.clientX, event.clientY);
        anchor = null;
        if (rect.right - rect.left < 5 || rect.bottom - rect.top < 5) return;
        try {
          const result = collect(document.body, undefined, rect);
          cleanup();
          resolve(result);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      const hover = (event: PointerEvent) => {
        if (mode === "area") {
          if (anchor) drawArea(areaAt(event.clientX, event.clientY));
          return;
        }
        const section = sectionAt(event.target);
        if (!section) {
          outline.style.display = "none";
          return;
        }
        const rect = section.getBoundingClientRect();
        Object.assign(outline.style, {
          display: "block",
          top: `${rect.top}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
      };
      const click = (event: MouseEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (mode === "area") return;
        const section = sectionAt(event.target);
        if (!section) {
          caption.textContent =
            "Choose a readable element rather than the entire document. Images need screenshot OCR. Esc cancels.";
          return;
        }
        try {
          const result = collect(section);
          cleanup();
          resolve(result);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      const cancel = () => {
        cleanup();
        reject(
          new Error("Section selection cancelled. No content was collected."),
        );
      };
      const key = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancel();
        }
      };
      const timer = setTimeout(cancel, 90000);
      document.addEventListener("pointermove", hover, true);
      document.addEventListener("pointerdown", down, true);
      document.addEventListener("pointerup", up, true);
      document.addEventListener("click", click, true);
      document.addEventListener("keydown", key, true);
      document.addEventListener("privacyshield-cancel-context-pick", cancel);
    });
  };
  try {
    return { capture: await run() };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not collect that scope.",
    };
  }
}

export async function readContext(
  mode: "selection" | "section" | "element" | "area" | "page" | "main",
  targetId?: number,
) {
  const tabId = targetId ?? (await currentTab()).id!;
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: captureContext,
    args: [mode],
  });
  const response = results[0]?.result;
  if (response?.error) throw new Error(response.error);
  const capture = response?.capture;
  if (!capture?.blocks.length)
    throw new Error("No context was collected. Choose a smaller section.");
  return capture;
}

export async function cancelContextPick(tabId: number) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () =>
      document.dispatchEvent(new Event("privacyshield-cancel-context-pick")),
  });
}
