export const isExtension =
  typeof chrome !== "undefined" && !!chrome.runtime?.id;
export async function currentTab() {
  if (!isExtension)
    throw new Error(
      "Open the installed extension from the browser toolbar to use tab actions.",
    );
  const requested = new URLSearchParams(location.search).get("targetTab");
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const tab =
    requested && /^\d+$/.test(requested)
      ? await chrome.tabs.get(Number(requested))
      : active;
  if (!tab?.id || !/^https?:/.test(tab.url ?? ""))
    throw new Error(
      "Open a regular website, then launch PrivacyShield from its toolbar icon. Browser pages are not supported.",
    );
  return tab;
}
export async function selection() {
  const tab = await currentTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => window.getSelection()?.toString() ?? "",
  });
  return result[0]?.result ?? "";
}
export async function pageText() {
  const tab = await currentTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const values: string[] = [];
      let size = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const p = node.parentElement;
        if (
          !p ||
          p.closest(
            "script,style,noscript,input,textarea,select,[contenteditable],#privacyshield-banner",
          ) ||
          !p.getClientRects().length
        )
          continue;
        const text = node.textContent?.trim();
        if (text) {
          size += text.length + 1;
          if (size > 100000)
            throw new Error("Page too long. Select a smaller section instead.");
          values.push(text);
        }
      }
      return values.join("\n");
    },
  });
  return result[0]?.result ?? "";
}
export async function toggleMode() {
  const tab = await currentTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    files: ["content.js"],
  });
}
export type MaskOptions = {
  treatment?: "replace" | "blur" | "hide";
  detected: boolean;
  fields: boolean;
  contacts: boolean;
  avatars: boolean;
  previews: boolean;
};
export type MaskReport = {
  treatment: "replace" | "blur" | "hide";
  structuredFields: number;
  fieldTypes?: { label: string; count: number }[];
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
export async function enableMode(options: MaskOptions): Promise<MaskReport> {
  const tab = await currentTab();
  const status = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => ({
      active: !!window.__privacyShield,
      modern: window.__privacyShield?.version === 2,
    }),
  });
  if (status[0]?.result?.active && !status[0]?.result?.modern)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => window.__privacyShield?.stop(),
    });
  if (!status[0]?.result?.active || !status[0]?.result?.modern)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      files: ["content.js"],
    });
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: (next) => window.__privacyShield?.configure(next),
    args: [options],
  });
  if (!result[0]?.result)
    throw new Error("Masking could not start on this page.");
  return result[0].result as MaskReport;
}
export async function disableMode() {
  const tab = await currentTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => window.__privacyShield?.stop(),
  });
}
export async function maskReport(): Promise<MaskReport | null> {
  const tab = await currentTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () =>
      window.__privacyShield?.version === 2
        ? window.__privacyShield.report()
        : null,
  });
  return (result[0]?.result as MaskReport | null) ?? null;
}
export async function startMaskPicker() {
  const tab = await currentTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => window.__privacyShield?.pick(),
  });
  await chrome.tabs.update(tab.id!, { active: true });
}
export async function undoManualMasks() {
  const tab = await currentTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      window.__privacyShield?.undoManual();
      return window.__privacyShield?.report() ?? null;
    },
  });
  return (result[0]?.result as MaskReport | null) ?? null;
}
export async function finishMaskPicker() {
  const tab = await currentTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => window.__privacyShield?.cancelPick(),
  });
}
export async function getFieldLabels() {
  const tab = await currentTab();
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => window.__privacyShield?.fieldLabels() ?? null,
  });
  if (!results[0]?.result)
    throw new Error("Turn privacy protection on, then scan page field labels.");
  return { ...results[0].result, tabId: tab.id! };
}
export async function applyAiFields(
  tabId: number,
  nonce: string,
  ids: string[],
) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (nonce: string, ids: string[]) =>
      window.__privacyShield?.maskAiFields(nonce, ids) ?? {
        error: "The page changed. Prepare a new privacy preview.",
      },
    args: [nonce, ids],
  });
  if (results[0]?.result?.error || !results[0]?.result?.report)
    throw new Error(
      results[0]?.result?.error ?? "Could not apply the page-field review.",
    );
  return results[0].result.report;
}
export async function clearManualMasks() {
  const tab = await currentTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      window.__privacyShield?.clearManual();
      return window.__privacyShield?.report() ?? null;
    },
  });
  return (result[0]?.result as MaskReport | null) ?? null;
}
export async function rescanMasks() {
  const tab = await currentTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      window.__privacyShield?.rescan();
      return window.__privacyShield?.report() ?? null;
    },
  });
  return (result[0]?.result as MaskReport | null) ?? null;
}
export async function modeStatus() {
  const tab = await currentTab();
  const r = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => !!window.__privacyShield,
  });
  return !!r[0]?.result;
}
export async function capture() {
  const tab = await currentTab();
  await chrome.tabs.update(tab.id!, { active: true });
  return chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
}
export async function readSettings(): Promise<Record<string, unknown>> {
  return isExtension
    ? chrome.storage.local.get(["onboarded", "strict", "activity", "counts"])
    : {};
}
export async function saveSettings(value: Record<string, unknown>) {
  if (isExtension) await chrome.storage.local.set(value);
}
export async function countScan() {
  if (!isExtension) return;
  const s = await readSettings();
  if (s.activity) await saveSettings({ counts: (Number(s.counts) || 0) + 1 });
}
