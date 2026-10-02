chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get("onboarded").then((s) => {
    if (!s.onboarded)
      void chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  });
});
chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    sender.id !== chrome.runtime.id ||
    !sender.tab?.id ||
    !/^https?:/.test(sender.url ?? "") ||
    message?.type !== "PRIVACY_CAPTURE_STATE" ||
    !["started", "ended", "recording"].includes(message.state)
  )
    return;
  const text =
    message.state === "recording"
      ? "REC"
      : message.state === "started" || message.state === "recording-stopped"
        ? "LIVE"
        : "";
  void chrome.action.setBadgeText({ tabId: sender.tab.id, text });
  void chrome.action.setBadgeBackgroundColor({
    tabId: sender.tab.id,
    color: "#315f42",
  });
});
