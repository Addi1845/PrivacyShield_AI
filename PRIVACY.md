# Privacy policy — local prototype 0.6.0

PrivacyShield reads supported webpage text when you choose a capture or turn on presentation protection. It does not inspect a website's backend, cookies, browser history or files. There is no analytics, advertising, microphone recording, remote OCR or automatic content upload. The extension does not record your screen.

## Local capture and protection

Ask privately accepts highlighted text, an outlined element/section, a dragged text rectangle, an explicit page scan, main content or a pasted excerpt. Automatic page/main scans skip supported navigation and account regions. Explicit selections can include those regions. Displayed form text can be collected; input/textarea/select values and iframe/canvas/video pixels are not read. Recognized private fields, including values paired with sensitive table labels, are excluded from the outgoing packet. Detectors can miss private information, so review remains necessary.

Text, task, preview and screenshots stay in session memory. Clear or close the UI to discard them. Presentation masking keeps original text/styles in content-script memory until stopped or the source tab reloads. The source website still has its original values. Blur and hide are visual treatments, not deletion, encryption or a restriction on the website's own scripts. Blur can leave clues; credentials receive Hide even in Blur mode. Screenshot exports contain altered pixels; blur is weaker than an opaque cover.

Only preferences, onboarding and an optional aggregate count enter local storage. User-enabled sharing reminders persist site match patterns in Chrome's registered-content-script settings, along with granted site permissions. These patterns are configuration, not browsing history. No capture pixels, audio or chosen surface content are collected by reminders.

## Optional external AI processing

The optional relevance check sends the included, locally sanitized blocks and sanitized task through a local backend to **Groq's API**. The optional presentation field review sends only the displayed, consented field-label list and opaque field IDs. Known sensitive labels are generalized; unknown labels are locally sanitized and shown before consent. Field values, photos, screenshots, excluded blocks and page URLs are not part of these requests. Labels themselves can reveal confidential context; inspect them. Pattern/schema checks cannot guarantee that every label or selected fact is nonprivate.

Each request requires user consent. AI returns existing block/field IDs only; it cannot retrieve more page content or invent replacement facts. Field review adds covers and does not remove existing local protection. API keys stay in the private backend environment and are not bundled. Request content is not logged. Provider processing/retention follows its terms; zero provider retention is not promised.

Legacy /review-context and fixed-code /explain routes remain for compatibility, outside the new Ask interface. They receive consented sanitized text/task or allowlisted finding codes respectively.

## Site-scoped sharing reminders

The default is off. Enabling reminders requests access only to the current HTTP(S) site. MAIN-world code wraps that site's browser getDisplayMedia requests, and an isolated script shows a pre-capture dialog. The user can prepare the actual source tab, continue without protection or cancel. The prompt is removed before capture starts. Browser permission and source-selection dialogs still apply.

A MediaRecorder using a tracked browser-capture stream can update the toolbar's LIVE/REC badge. The extension never receives the stream or records it. Native apps, OBS, operating-system recording, other recording extensions, unenabled sites, cross-origin frames and previously cached/overridden capture APIs are not universally detected. A page can tamper with MAIN-world code/events. This is a reminder, not enforced DLP.

Disabling unregisters future reminders and removes active hooks from reachable open tabs on that site. Previously granted optional site access remains in Chrome until revoked through extension site-access controls. Reload the site if a closing/navigating tab prevented cleanup.

## Sharing and retention

Approved handoff writes the validated packet to your clipboard and opens a blank AI chat; you paste/submit. An AI still sees your login and separately authorized information. Native browser AI cannot be intercepted. Do not attach the original tab if you want the reviewed-context boundary to hold.

Controls remain outside the source page during tab sharing. Entire-screen capture can include visible extension panels and preflight UI. Share a prepared tab or reviewed snapshot. This extension cannot selectively filter a desktop, hide native meeting windows or prevent all profiling.

Clear sessions, delete optional counts in Settings and revoke backend/site access there or in Chrome. Reload protected tabs before uninstalling. Clipboard contents and downloaded exports remain under your control.
