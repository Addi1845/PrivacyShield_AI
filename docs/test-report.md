# Verification report — 2026-10-02

Release: **0.6.0**. Results below concern synthetic fixtures and the current configured local prototype.

| Check | Result |
|---|---|
| Build | Passed; loadable MV3 extension with bundled offline OCR |
| Typecheck | Passed |
| Lint | Passed |
| Unit/API tests | 40 passed across 4 files |
| Browser tests | 18/18 passed; final focused five-test upgrade rerun also passed |
| Bundle audit | 26 extension files checked; no API credential, environment file or remote HTML script |
| npm audit | Zero known vulnerabilities at check time, including development dependencies |
| Live AI subset request | Historical HTTP 200 synthetic laptop check; unchanged integration |
| Live AI field-label request | HTTP 200; selected name/DOB labels, omitted public memory label; no values/photos sent |
| Initial-dashboard axe check | Zero reported WCAG A/AA violations |

## Browser evidence

1. Real installed-extension scoped capture: section outline and click, explicit extra section, partial text Range, main content, no body fallback, cancellation, frozen snapshots, approval revocation and no context persistence. Unrelated navigation/account/title/history/form/hidden canaries absent in that task; explicit selections can now include navigation/displayed forms for review.
2. Review-gated clipboard copy and actual paste into a local HTTP receiver. Product price/specification preserved; source credentials/identity absent; inserted credential blocks copying.
3. Presentation masking, dynamic text, manual hide/undo and restoration; no persistent shared-page banner.
4. WhatsApp contact aliases, avatars, sidebar previews and fields covered with no shared-page controls.
5. Local screenshot OCR, zero image HTTP requests, manual rectangles, opaque exported pixels and clear-image reset.
6. 390 px layout without horizontal overflow and restricted-page denial.
7. Separate real isolated masking injection with localhost-only test host grant.
8. Initial-dashboard accessibility plus popup screenshots.
9. OCR load failure reaches manual review; unreviewed export remains disabled.
10. Entire-screen limitation guide and isolated reviewed meeting snapshot without source canaries.
11. Gemini blank-chat handoff: reviewed clipboard, no content URL and no auto-submit.
12. Optional AI check gets only sanitized included blocks, removes an unneeded block, clears approval, and allows public-block reinclusion.
13. Split DOM text, fields and open shadow-root masking/restoration; field changes made while masked survive restoration.

14. Synthetic admissions-form separate name/DOB/application/demographic/income cells and candidate photo covered; public specifications/labels left readable. Blur/Hide switching, repeated manual selection, last-area undo, dynamic rows, labels-only AI UI consent and full restoration verified.
15. Exact table-cell and navigation selection, bounded text rectangle excluding an adjacent canary, partial highlighted Range and explicit page scan with private form values excluded.
16. Browser-capture shim: cancel prevents native call; trusted continuation retains fresh activation; dialog removed before capture; tracked MediaRecorder LIVE/REC/ended state and original API restoration verified.
17. Per-site reminder registration survives reload and disabling unregisters scripts/removes hooks from multiple open tabs.
18. Packaged form OCR covers values separated from labels; screenshot Hide yields opaque pixels and Blur alters the treatment with no image HTTP requests.

The complete 18-test suite passed. Subsequent field-report/AI-private-marker refinements were checked with a focused five-test rerun; these tests include the changed protection, context and capture paths.

## Local/API evidence

Tests exercise identity/credential exclusion, task-based relevance, preserved heading/spec relationships, task sanitization, unsafe output, empty/oversized input, origin and schema gates, explicit consent, private task fields, invented/duplicate/excluded AI IDs and structured subset responses.

The latest field-label connectivity check used only three synthetic field types. It returned f0/f1 for Personal name/Date of birth and excluded Laptop memory; the record is ai-field-verification.json. Historical laptop evidence remains in ai-subset-verification.json. It verifies the configured endpoint, not generalized model accuracy, population leakage rates or provider retention.

## Limits of verification

Toolbar activeTab gestures, side-panel opening, optional permission dialogs and revocation still require manual verification in regular Chrome. Injected capture uses a temporary localhost-granted extension fixture; the production manifest has no required host permissions. Browser AI processing is stubbed in its UI test, with provider connectivity separately checked live.

Structural detection and pattern matching can miss private concepts. Native browser AI and full-desktop capture remain outside this extension. Capture monitoring uses a synthetic canvas stream in browser tests; real native source-picker UI, real meeting sites and native recording apps are not represented as tested. Accessibility automation covers the initial dashboard, not a full assistive-technology certification.

## Artifacts

Selected synthetic illustrations are kept in docs/screenshots: dashboard, form-blurred, capture-preflight and form-ocr-review. The browser tests generate additional local evidence when run.

Machine-readable records: accessibility-results.json, ai-subset-verification.json and ai-field-verification.json. Browser: Chromium 153.0.8010.12. Older performance/provider records remain historical evidence, not fresh benchmarks.
