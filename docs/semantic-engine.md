# Semantic accuracy upgrade

## Inspected baseline

Present Safely uses content.ts to own reversible text/style changes. privacy-core finds known patterns; field-core and page-fields associate known labels with values. A MutationObserver rescans dynamic text. The optional field endpoint previously classified table labels only.

Ask Privately explicitly captures a scope, prepares locally sanitized choices, optionally minimizes approved context, and requires final packet approval. Screenshot sanitization uses packaged Tesseract and local canvas redaction. The loopback API holds provider credentials and validates the configured extension origin.

## Boundary for the upgrade

Improve these systems in place. Semantic candidates have two representations: local source text and a reduced external representation. The latter contains opaque IDs, reviewed labels and the constant `[VALUE_WITHHELD]`. Actual values, source DOM, selectors, URLs and screenshots are not semantic API inputs. Labels themselves may reveal context, so exact-label review and explicit consent remain necessary. Unlabelled prose cannot safely be sent to a remote classifier by assuming it contains no private information.

The model classifies; local code validates IDs and decides protection. It cannot remove deterministic protection. Confidence is a routing hint, not proof. Uncertain findings require review. Local protection works without the backend.

## Implemented flow

1. DOM extraction reads visible, bounded text and associates table cells, definition lists, two-child cards, simple nested wrappers and ARIA labels with values. Existing site-specific masking remains. Critical deterministic rules still run first, including Employee UID fields and password inputs.
2. Pure semantic-core produces local decisions. Known private data is protected locally; common public specifications do not need an AI request. Explicit internal/confidential text gets additional local protection.
3. Ambiguous short labels become `{id, label, text: "[VALUE_WITHHELD]"}`. Present Safely deduplicates labels and keeps one-to-many element references locally. Source fingerprints, references and nonces never reach the provider. The scan is bounded to 10,000 visited text nodes / 500 local candidates / 50 distinct outgoing labels; oversized/unlabelled content needs manual selection.
4. The user reviews the exact labels, grants consent and classifies them. `/classify-elements` accepts only a fixed purpose, consent and reduced elements. The server checks origin, schemas, sizes, unique IDs, obvious forbidden values, quota and a 20-second provider deadline. The default model is `openai/gpt-oss-20b`. Groq uses a strict JSON schema for supported GPT-OSS models; other configurations use JSON-object output plus the same mandatory validation.
5. Both server and client reject unexpected keys, missing/unknown/duplicate IDs, invalid categories/actions and nonfinite/out-of-range confidence. Model explanations are discarded. No selectors, executable code or replacement text are accepted.
6. The user applies the reviewed result. A score of at least 0.90 makes a protective result eligible; lower scores require an explicit Protect selection. AUTH_SECRET always becomes HIDE. Local priority is HIDE > MASK > ALIAS > REVIEW > ALLOW. Semantic ALIAS conservatively uses the selected visual mask treatment rather than inventing replacement values. Existing deterministic aliases remain unchanged.
7. Content-script validation rejects stale source fingerprints before applying any result. Semantic masks coexist with automatic/manual masks; stop restores styles and attributes. Confirmed meanings protect matching dynamically inserted labels locally. No mutation triggers an automatic external request.
8. Optional persistence hashes normalized labels and stores only hash/category/action/expiry, capped at 100 entries for 30 days. It stores neither values nor readable labels. Reused protection is loaded locally in new sessions. Settings can clear it; active-session masks remain until protection stops. Cache failure does not block masking. Hashes of common labels can be guessed; this is data minimization, not encryption.

## Ask Privately and screenshots

Selected context keeps field metadata when additional scopes are appended. Known private fields remain locked. Optional semantic review classifies ambiguous labels associated with captured blocks; reviewed private blocks become persistent session locks that survive task/relevance rebuilds. Applying privacy findings cancels any older relevance request so it cannot reintroduce a protected block. Exact outgoing-packet review and final local validation remain mandatory.

Screenshot processing still uses packaged Tesseract. Local OCR and deterministic row masking run first. Only separate left-hand labels with plausible same-row value geometry are eligible for semantic review. The source image, recognized values, coordinates and row maps stay local. Reviewed IDs map back to original OCR boxes, and local canvas operations cover pixels. Export approval is revoked after protection changes. Inline OCR prose is deliberately not sent remotely.

## What the provider receives

For the **new semantic endpoint**: a fixed privacy purpose, at most 50 opaque IDs, explicitly reviewed short labels, and constant withheld-value markers. The request does not include HTML, DOM selectors, page URL, input values, source screenshots, bounding boxes, cookies or browser history. Provider account/network metadata still exists outside the payload.

The **existing relevance endpoint** continues to receive the user's separately consented, locally reduced task and included blocks. This upgrade does not silently change its permission into permission to upload a raw page. Legacy field review still sends consented labels/IDs. Provider configuration stays in `.env`; default Groq and optional OpenRouter share the same semantic boundary. No new dependency, telemetry, account system or required host permission was introduced.

## Limits and next improvements

- This improves field-based detection; it does not guarantee arbitrary private prose detection. Without exposing source text, a remote model cannot identify every unlabelled relationship or private narrative. Manual selection remains essential.
- Labels can themselves contain private context, and a page can mislabel values. Exact request review remains necessary. Local schema checks are not proof of anonymity.
- Model confidence is uncalibrated. False positives/negatives remain possible. A representative, consented benchmark across websites and languages is the next accuracy step; current synthetic fixtures are regression tests, not measured universal accuracy.
- Stored meanings apply across sites and may overprotect an identically named public field. Cache entries only add protection, expire, and can be cleared. Future context-scoped hashes could reduce false positives without persisting URLs.
- DOM semantic review currently targets the top document. Existing local scanning also traverses open shadow roots; closed roots, cross-origin frames, browser UI, video and canvas content are not universally covered.
- Packaged OCR is English. Multilingual DOM labels can be classified, but reliable Marathi/Hindi image recognition would require separately packaged OCR language assets and evaluation.
- Visual blur is weaker than opaque hiding. Page scripts retain original data. Mutation-driven protection can have a brief exposure window; it is not a secure screen-capture compositor.
- Native browser AI, native recording tools and entire-screen capture remain outside universal interception. Browser panels can appear in entire-screen sharing. Use a prepared tab or reviewed export.
- Cache entries are bounded and best effort, not a database. API downtime, invalid responses and quota failures leave deterministic protection active and never certify a page safe.

## Provider references

Implementation checked against [Groq structured outputs](https://console.groq.com/docs/structured-outputs) and [OpenRouter API reference](https://openrouter.ai/docs/api/reference/overview). Live Groq verification sent four synthetic labels only: English/Marathi name labels and a Hindi birth-date label received protective classifications; an ambiguous Memory label scored 0.8 and therefore required review. This is a smoke test, not an accuracy benchmark. OpenRouter was verified with mocked transport, not a live account.

## Verification results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 74 unit/API tests passed across 6 files.
- `npm run build`: passed; loadable MV3 extension generated.
- `npm run test:e2e`: 25 browser tests passed, including live local OCR, semantic pixel covering, dynamic masking, cache reuse, restore/manual coexistence, stale IDs, offline fallback and Ask locks.
- `npm run audit:bundle`: passed for 26 bundled files. No recognized provider credentials, environment files or remote HTML script tags.
- `npm audit --fetch-retries=0 --fetch-timeout=30000`: zero vulnerabilities. The initial `npm audit` found a development-tool dependency issue; typescript-eslint was upgraded to 8.71.0 to remove the vulnerable chain. No runtime dependency was added.
- Live Groq synthetic-label smoke test: HTTP 200; no private source content supplied.
- `git diff --check`: passed.

The generated package is `dist/PrivacyShield-v0.7.2.zip` and contains only the extension and license notices. Reload the extension from `dist/extension` and refresh existing source tabs to use the new content script. Run `npm run api` for optional AI checks.

## Exact source file changes

Created:

- `apps/api/semantic.mjs`
- `apps/extension/src/semantic-cache.ts`
- `apps/extension/src/semantic-ocr.ts`
- `apps/extension/src/semantic-page.ts`
- `apps/extension/src/semantic-review.tsx`
- `docs/semantic-engine.md`
- `packages/semantic-core/index.ts`
- `packages/semantic-core/schema.d.mts`
- `packages/semantic-core/schema.mjs`
- `tests/e2e/semantic.spec.ts`
- `tests/unit/semantic-api.test.ts`
- `tests/unit/semantic.test.ts`

Modified:

- `.env.example`
- `PRIVACY.md`
- `README.md`
- `apps/api/server.d.mts`
- `apps/api/server.mjs`
- `apps/extension/manifest.json`
- `apps/extension/src/app.tsx`
- `apps/extension/src/ask-privately.tsx`
- `apps/extension/src/content.ts`
- `apps/extension/src/context-capture.ts`
- `apps/extension/src/field-review.tsx`
- `apps/extension/src/meeting-guide.tsx`
- `apps/extension/src/page-fields.ts`
- `apps/extension/src/runtime.ts`
- `apps/extension/src/screenshot.tsx`
- `docs/architecture.md`
- `package-lock.json`
- `package.json`
- `packages/context-core/index.ts`
- `packages/field-core/index.ts`
- `packages/privacy-core/index.ts`
- `scripts/audit.mjs`
- `tests/unit/privacy.test.ts`

Security-maintenance reference: [braces advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

## 0.7.1 layout and connectivity follow-up

The MahaDBT screenshot exposed a structural gap: label/value associations were limited to two-child containers or adjacent table cells. Extraction now skips line breaks/decorative nodes, recognizes explicit labels in larger cards, handles linked values and bounded direct-text field containers, and checks ARIA labels before walking wrappers. Ask capture preserves corresponding structural metadata. A regression fixture covers application IDs, partially masked mobile numbers, unfamiliar role labels, nested values and public prices. This is a synthetic reconstruction; the live authenticated MahaDBT DOM was not inspected.

The subsequent unavailable screenshot was investigated locally: port 4318 had no listener. The configured backend was started and a synthetic-label request returned HTTP 200. UI errors now distinguish an unreachable local service, origin mismatch, rejected input, rate limiting and provider failure. Zero candidates explicitly says no AI request was made; it is not a privacy success signal. The backend must stay running for optional AI checks.

Follow-up verification: typecheck, lint, 74 unit/API tests, all 25 browser tests, build and bundle audit passed; npm audit reported zero vulnerabilities. The restarted local service returned HTTP 200 for a synthetic label request.

## Compact personal-name field correction

Standalone text sanitization now recognizes explicit Name, first/last/given name, surname, display name and account-holder fields with flexible colon/equal spacing, case, Unicode values and a single line break between label and value. The old label heuristic required whitespace after Name:, causing the reported Name:Aditya miss. Balanced mode produces Person 1; strict mode redacts the value. A UI regression verifies that the fix uses no HTTP request and preserves adjacent product facts. Source changes: packages/privacy-core/index.ts, tests/unit/privacy.test.ts, tests/e2e/semantic.spec.ts.

Name-field fix verification: 74 unit/API tests and 25 browser tests passed. Typecheck, lint, build, bundle audit and archive content checks passed; npm audit reported zero vulnerabilities. The original UI screenshot case is covered by a browser test verifying no external HTTP request.
