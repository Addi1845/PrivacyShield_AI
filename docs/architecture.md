# Architecture — 0.6.0

## Task-bounded AI handoff

User task → explicit scope capture → structural exclusion → local detection → task relevance suggestions → per-block review → optional AI subset check → exact packet preview → user approval → clipboard + optional blank AI tab.

The React/TypeScript MV3 application is bundled with esbuild. The new AskPrivately component is separate from the existing presentation and standalone text editors. packages/context-core contains pure task/block preparation, packet construction, output validation and subset validation. It has no network or browser access.

context-capture runs a self-contained function in the scripting API's isolated world. It handles exact element/section picking, an actual text Range, character-bounded text rectangles, explicit page scanning and unambiguous main/article capture. Automatic scopes exclude navigation/account regions; explicit scopes allow them. Editable controls and unsupported surfaces are excluded. Table/dl value blocks carry associated labels for local exclusion. There is no silent body fallback; oversized or unavailable scopes fail with an explanatory message. A serializable result envelope preserves errors across Chrome's injection boundary.

Headings carry local section identifiers so product names remain associated with useful facts. These structural identifiers are not page URLs or attributes. Requests to AI carry only the public block IDs and sanitized text.

A session pins its source tab after the first capture. Relevance changes operate on a memory snapshot, not a fresh page read. Adding content requires another explicit selection. Generation checks and request abortion prevent stale capture/AI responses replacing a cleared session. New capture failures cannot reuse a previous release-ready packet.

## AI processing

The optional backend binds to 127.0.0.1:4318. Its /minimize-context endpoint accepts only consent, a sanitized purpose and bounded unique blocks. It validates the exact configured extension Origin, payload keys, direct identifiers/secret patterns, sizes, rate limits and upstream timeout. Credentials stay in backend environment memory. It has no page-reading tools.

The provider receives only included, locally reduced blocks. It returns keepIds. Both server and extension reject invented, duplicate or previously excluded IDs. The extension applies the subset to its own stored facts; no model-generated wording is used in the packet. An empty/invalid selection leaves the local draft available and unapproved. The user can reinclude public blocks.

Groq is infrastructure and is disclosed in the optional processing consent. It is not a product mode, provider-selection screen or chatbot destination. Legacy /review-context and /explain routes remain for compatibility, outside the new UI.

## Sharing and presentation

The clipboard release gate validates the task and captured source against the exact output and blocks detected originals/new supported secrets. Task, block, preview or destination changes clear approval. Gemini, ChatGPT and Claude open as blank destinations without prompt URLs or auto-submission.

Presentation uses the existing isolated visual masking content script, category controls and mutation rescanning. Original mappings stay in its memory and are restored on stop. The clean meeting tab receives only reviewed text through a short-lived, identity-checked extension handshake. No source payload is placed in storage or a URL.

Screenshot OCR uses packaged English data and a local worker/WASM runtime. field-core classifies labels; row geometry joins separated sensitive labels/values. Canvas exports support opaque Hide or Blur; credential rows stay opaque. Images are not sent to the AI API.

Presentation content uses per-element sets of mask reasons, original styles and ordered manual selections. Undo removes one manual reason without removing automatic protection. Configure restores/reapplies styles to change treatments. Recognized table/dl/label pairs are protected separately from label text. AI field review uses a nonce-bound registry of existing elements, sends only inspected labels, validates returned IDs and adds masks. /classify-fields shares the origin/schema/timeout gates of the minimizer.

Opt-in sharing reminders register per-site document_start MAIN/ISOLATED scripts. MAIN wraps getDisplayMedia and MediaRecorder for observed streams; isolated code shows a preflight and sends only activity state to the worker. Fresh continuation clicks call the native capture API synchronously before activation expires. The preflight is removed first. Cancellation rejects the capture promise. Scripts unregister on disable; hooks are removed from reachable open tabs on that site. The page can tamper with this advisory bridge.

## Permissions

| Permission | Purpose |
|---|---|
| activeTab | Temporary user-invoked webpage access |
| scripting | Scoped capture and tab masking |
| storage | Preferences, onboarding, optional aggregate count |
| sidePanel | Review beside the source webpage |
| clipboardWrite | User-approved output; no clipboard reads |
| Optional chosen HTTP(S) site | User-enabled capture reminders; grant only the chosen site, never all sites by default |
| Optional loopback host | Explicit permission to contact the local AI backend; CSP narrows connections to port 4318 |

The production manifest has no required host access, default all-site content scripts, history/cookie/debugger access or webRequest interception. Local OCR requires wasm-unsafe-eval; JavaScript eval is not enabled. The manifest public key supplies a stable extension ID and is not a credential.

## Limits

Structural exclusion is heuristic. Unlabeled names, internal project identifiers, imagery and confidential facts may survive in a selected block. Users inspect before external processing and before final handoff. The extension controls its own packet, not native browser AI, connected accounts, desktop sharing or provider retention. IDE/folder controls and enterprise policy enforcement remain future work.
