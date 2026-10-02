export {};
const content = document.querySelector("#shared-content")!;
const status = document.querySelector("#view-status")!;
const channel = location.hash.slice(1);
async function receive() {
  for (let i = 0; i < 20; i++) {
    try {
      const result = await chrome.runtime.sendMessage({
        type: "MEETING_READY",
        channel,
      });
      if (typeof result?.text === "string" && result.text.length <= 100000) {
        content.textContent = result.text;
        status.textContent = "Reviewed snapshot · not a live mirror";
        return;
      }
    } catch {
      /* Review page may still be preparing its handoff. */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  status.textContent =
    "Snapshot unavailable. Return to the review and open a new meeting tab.";
}
void receive();
document.querySelector("#clear-view")!.addEventListener("click", () => {
  content.textContent = "";
  status.textContent = "Content cleared. Stop sharing this tab when finished.";
});
document.querySelector("#fullscreen")!.addEventListener("click", () => {
  void document.documentElement.requestFullscreen().catch(() => {
    status.textContent =
      "Fullscreen unavailable. You can still share this tab.";
  });
});
