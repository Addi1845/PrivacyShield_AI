(() => {
  const stateSlot = window as unknown as Record<string, unknown>;
  if (stateSlot.__privacyShieldShareMonitor) return;
  stateSlot.__privacyShieldShareMonitor = true;
  let host: HTMLElement | null = null;
  let currentSession = "";
  const active = new Map<string, boolean>();
  const decide = (decision: "allow" | "cancel") => {
    host?.remove();
    host = null;
    document.dispatchEvent(
      new CustomEvent("privacyshield-capture-decision", {
        detail: { session: currentSession, decision },
      }),
    );
  };
  const intent = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (
      typeof detail?.session !== "string" ||
      !/^[\w-]{36}$/.test(detail.session)
    )
      return;
    if (host) decide("cancel");
    currentSession = detail.session;
    host = document.createElement("div");
    host.id = "privacyshield-share-preflight";
    const root = host.attachShadow({ mode: "open" });
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "Privacy before sharing or recording");
    dialog.style.cssText =
      "padding:26px;border:1px solid #b8bbb3;border-radius:10px;max-width:470px;background:#faf9f5;color:#171b18;font:14px/1.6 system-ui;box-shadow:0 20px 90px #0005";
    const title = document.createElement("h2");
    title.textContent = "Before you share or record";
    title.style.cssText = "font-size:22px;margin:0 0 12px";
    const body = document.createElement("p");
    body.textContent =
      "Prepare the tab you intend to show using PrivacyShield’s toolbar. Choose Blur to signal protected content, or Hide to remove it from view. Then return here and choose that prepared tab in the browser’s sharing dialog.";
    const limits = document.createElement("p");
    limits.textContent =
      "This reminder does not filter a desktop or identify the tab you will choose. Share the prepared browser tab only.";
    limits.style.cssText = "font-size:12px;color:#626961";
    const ready = document.createElement("label");
    ready.style.cssText =
      "display:flex;align-items:flex-start;gap:9px;margin:16px 0";
    const checked = document.createElement("input");
    checked.type = "checkbox";
    ready.append(
      checked,
      document.createTextNode("I inspected the protected tab I will share."),
    );
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
    const button = (text: string, action: () => void) => {
      const b = document.createElement("button");
      b.textContent = text;
      b.style.cssText =
        "padding:9px 12px;border:1px solid #b8bbb3;border-radius:5px;background:#fff;color:#171b18;font:600 12px system-ui;cursor:pointer";
      b.addEventListener("click", action);
      actions.append(b);
      return b;
    };
    const proceed = button("Continue with prepared tab", () => decide("allow"));
    proceed.disabled = true;
    checked.addEventListener("change", () => {
      proceed.disabled = !checked.checked;
    });
    button("Continue without protection", () => decide("allow"));
    button("Cancel sharing", () => decide("cancel"));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      decide("cancel");
    });
    dialog.append(title, body, limits, ready, actions);
    root.append(dialog);
    document.documentElement.append(host);
    dialog.showModal();
  };
  const state = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (
      !detail ||
      ![
        "started",
        "ended",
        "cancelled",
        "recording",
        "recording-stopped",
      ].includes(detail.state)
    )
      return;
    host?.remove();
    host = null;
    if (typeof detail.session !== "string") return;
    if (detail.state === "started") active.set(detail.session, false);
    if (detail.state === "recording") active.set(detail.session, true);
    if (detail.state === "recording-stopped" && active.has(detail.session))
      active.set(detail.session, false);
    if (detail.state === "ended") active.delete(detail.session);
    void chrome.runtime
      .sendMessage({
        type: "PRIVACY_CAPTURE_STATE",
        state: [...active.values()].some(Boolean)
          ? "recording"
          : active.size
            ? "started"
            : "ended",
      })
      .catch(() => {});
  };
  const disable = () => {
    if (host) decide("cancel");
    delete stateSlot.__privacyShieldShareMonitor;
    document.removeEventListener("privacyshield-capture-intent", intent);
    document.removeEventListener("privacyshield-capture-state", state);
    document.removeEventListener("privacyshield-monitor-disable", disable);
  };
  document.addEventListener("privacyshield-capture-intent", intent);
  document.addEventListener("privacyshield-capture-state", state);
  document.addEventListener("privacyshield-monitor-disable", disable);
})();
