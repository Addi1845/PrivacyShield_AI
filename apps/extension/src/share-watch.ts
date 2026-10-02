import { currentTab, isExtension } from "./runtime";
const ids = (match: string) => {
  let hash = 2166136261;
  for (const letter of match)
    hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  const id = `privacy-watch-${(hash >>> 0).toString(16)}`;
  return [id + "-main", id + "-isolated"];
};
export async function watchStatus() {
  const tab = await currentTab();
  const url = new URL(tab.url!);
  const match = `${url.protocol}//${url.hostname}/*`;
  const scripts = await chrome.scripting.getRegisteredContentScripts({
    ids: ids(match),
  });
  return {
    enabled:
      scripts.length === 2 &&
      (await chrome.permissions.contains({ origins: [match] })),
    match,
    tabId: tab.id!,
  };
}
export async function setShareWatch(enabled: boolean) {
  if (!isExtension)
    throw new Error("Install the extension to enable sharing reminders.");
  const { match, tabId } = await watchStatus();
  if (enabled) {
    if (!(await chrome.permissions.request({ origins: [match] })))
      throw new Error(
        "Site access was not granted. Use the manual privacy switch before sharing.",
      );
    const registered = await chrome.scripting.getRegisteredContentScripts({
      ids: ids(match),
    });
    if (registered.length !== 2) {
      if (registered.length)
        await chrome.scripting.unregisterContentScripts({
          ids: registered.map((s) => s.id),
        });
      await chrome.scripting.registerContentScripts([
        {
          id: ids(match)[0],
          matches: [match],
          js: ["share-monitor-main.js"],
          runAt: "document_start",
          world: "MAIN",
          persistAcrossSessions: true,
        },
        {
          id: ids(match)[1],
          matches: [match],
          js: ["share-monitor.js"],
          runAt: "document_start",
          world: "ISOLATED",
          persistAcrossSessions: true,
        },
      ]);
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["share-monitor.js"],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["share-monitor-main.js"],
      world: "MAIN",
    });
  } else {
    await chrome.scripting.unregisterContentScripts({ ids: ids(match) });
    for (const tab of await chrome.tabs.query({ url: match })) {
      if (!tab.id) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: () =>
            document.dispatchEvent(new Event("privacyshield-monitor-disable")),
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () =>
            document.dispatchEvent(new Event("privacyshield-monitor-disable")),
        });
        await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
      } catch {
        /* A closing or navigating tab will unload its listeners. */
      }
    }
  }
  return enabled;
}
