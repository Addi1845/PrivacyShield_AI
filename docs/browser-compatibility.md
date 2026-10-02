# Browser compatibility

Automated loaded-extension testing: **Chromium 153.0.8010.12**, headless, Windows, Playwright 1.63.0. Browser version is recorded in the local Playwright runtime output. Manifest minimum is Chrome 116 based on the side-panel API; older versions have not been tested. Regular Chrome toolbar interaction, operating-system dialogs, Edge and Firefox are not certified by these automated tests.

| Surface | Coverage |
|---|---|
| Actual packaged MV3 dashboard, worker and CSP | Loaded and tested |
| Sanitized clipboard paste into local HTTP receiver | Tested, canary absent and amount preserved |
| Isolated-world injection with chrome.scripting | Tested using a separate temporary package with a localhost-only required host grant; production manifest remains unchanged |
| Native optional host-permission dialog / actual toolbar activeTab grant | Manual verification still required; not bypassed or represented as automated coverage |
| Permission unavailable on browser/extension page | Tested visible error |
| DOM mask, split-node detection, supported visible text, fields, open shadow roots, mutation, manual hide and restore | Tested |
| Offline packaged OCR, label/value rows and Blur/Hide bitmap export | Tested in actual extension |
| Per-site MAIN/ISOLATED capture reminders | Registration/reload/disable, cancellation, fresh activation and tracked recording tested with synthetic capture streams; native chooser remains manual |
| Side-panel-width layout (390 px) | Tested, no horizontal overflow; actual native side-panel opening needs toolbar check |
| Groq backend | Live HTTP completion verified; browser UI request and quota handling tested using a stub |
| Gemini web handoff | Tested reviewed clipboard output and blank Gemini URL; no automatic submit |
| Chrome built-in Ask Gemini | Cannot be intercepted; disable default page sharing and remove source tabs |
| Forms/contenteditable | Entire controls are hidden without reading values; user edits made while hidden are preserved |
| Split text nodes and open shadow DOM | Tested; closed shadow roots and attributes remain unsupported |
| Cross-origin frames, canvas, video, desktop, browser chrome | Not protected; limitations are disclosed in the private extension setup |

Privacy Mode operates after insertion and can briefly show new content before rescanning. Entire-screen/window sharing is not filtered. Use the masked browser tab or the extension-owned clean meeting snapshot and share only that tab. The tests do not establish zero-frame masking or screen-sharing-product compatibility.

Official APIs checked: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [screen capture](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture), [getDisplayMedia activation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia).
