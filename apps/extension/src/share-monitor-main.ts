// Opt-in, site-scoped MAIN-world shim; never reads captured pixels.
(() => {
  const devices = navigator.mediaDevices;
  if (
    !devices?.getDisplayMedia ||
    Object.hasOwn(devices, "__privacyShieldMonitor")
  )
    return;
  const original = devices.getDisplayMedia;
  const descriptor = Object.getOwnPropertyDescriptor(
    devices,
    "getDisplayMedia",
  );
  const pending = new Map<string, { allow: () => void; deny: () => void }>();
  const tracks = new Map<MediaStreamTrack, string>();
  const notify = (state: string, session: string, surface = "unknown") =>
    document.dispatchEvent(
      new CustomEvent("privacyshield-capture-state", {
        detail: { state, session, surface },
      }),
    );
  const decision = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail || typeof detail.session !== "string") return;
    const request = pending.get(detail.session);
    if (!request) return;
    if (detail.decision === "allow") request.allow();
    else if (detail.decision === "cancel") request.deny();
  };
  const wrapper: MediaDevices["getDisplayMedia"] = function (options) {
    const session = crypto.randomUUID();
    return new Promise<MediaStream>((resolve, reject) => {
      const finish = () => {
        clearTimeout(timer);
        pending.delete(session);
      };
      const deny = () => {
        finish();
        notify("cancelled", session);
        reject(
          new DOMException(
            "Sharing cancelled in PrivacyShield. Click Share again when ready.",
            "NotAllowedError",
          ),
        );
      };
      const allow = () => {
        finish();
        // Invoke synchronously from a fresh user click; awaiting setup loses activation.
        let request: Promise<MediaStream>;
        try {
          request = original.call(devices, options);
        } catch (error) {
          notify("cancelled", session);
          reject(error);
          return;
        }
        request
          .then((stream) => {
            const videos = stream.getVideoTracks();
            for (const track of videos) {
              tracks.set(track, session);
              const ended = () => {
                if (!tracks.delete(track)) return;
                if (![...tracks.values()].includes(session))
                  notify("ended", session);
              };
              track.addEventListener("ended", ended, { once: true });
              const stop = track.stop;
              track.stop = () => {
                stop.call(track);
                ended();
              };
            }
            notify(
              "started",
              session,
              videos[0]?.getSettings().displaySurface ?? "unknown",
            );
            resolve(stream);
          })
          .catch((error) => {
            notify("cancelled", session);
            reject(error);
          });
      };
      const timer = setTimeout(deny, 120000);
      pending.set(session, { allow, deny });
      document.dispatchEvent(
        new CustomEvent("privacyshield-capture-intent", {
          detail: { session },
        }),
      );
    });
  };
  const recorder = window.MediaRecorder;
  let recorderProxy: typeof MediaRecorder | undefined;
  if (recorder) {
    recorderProxy = new Proxy(recorder, {
      construct(target, args, newTarget) {
        const instance = Reflect.construct(
          target,
          args,
          newTarget,
        ) as MediaRecorder;
        const session = (args[0] as MediaStream)
          ?.getVideoTracks()
          .map((track) => tracks.get(track))
          .find(Boolean);
        if (session) {
          instance.addEventListener("start", () =>
            notify("recording", session),
          );
          instance.addEventListener("stop", () =>
            notify("recording-stopped", session),
          );
        }
        return instance;
      },
    });
  }
  const disable = () => {
    for (const request of [...pending.values()]) request.deny();
    if (devices.getDisplayMedia === wrapper) {
      if (descriptor)
        Object.defineProperty(devices, "getDisplayMedia", descriptor);
      else
        delete (devices as unknown as Record<string, unknown>).getDisplayMedia;
    }
    if (recorderProxy && window.MediaRecorder === recorderProxy)
      window.MediaRecorder = recorder;
    document.removeEventListener("privacyshield-capture-decision", decision);
    document.removeEventListener("privacyshield-monitor-disable", disable);
    delete (devices as unknown as Record<string, unknown>)
      .__privacyShieldMonitor;
  };
  try {
    Object.defineProperty(devices, "getDisplayMedia", {
      value: wrapper,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(devices, "__privacyShieldMonitor", {
      value: true,
      configurable: true,
    });
    if (recorderProxy) window.MediaRecorder = recorderProxy;
    document.addEventListener("privacyshield-capture-decision", decision);
    document.addEventListener("privacyshield-monitor-disable", disable);
  } catch {
    disable();
  }
})();
