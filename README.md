# PrivacyShield

**Give AI the context it needs. Keep the rest of the page private.**

Version 0.7.3 is a Chrome Manifest V3 extension with two main jobs: **Ask privately** and **Present safely**. A supporting sanitization studio cleans text and screenshots. The interface uses graphite, ivory and restrained green, with no provider-branded chatbot.

## Ask privately

1. Describe the task, such as comparing two laptops for coding.
2. Pick an element/section, highlight exact text, drag a text rectangle, explicitly scan the page, find unambiguous main content, or paste an excerpt. There is no silent whole-page fallback.
3. Review included/excluded blocks. Automatic page/main scans skip supported navigation and account regions; explicit selections can include them. Displayed form values are checked against associated sensitive labels; editable input values and unsupported surfaces are skipped. Recognized identity fields and secrets are excluded; useful product headings, specifications, prices and units stay together.
4. Optionally check task relevance with AI. The processor can select a subset of included blocks; it cannot rewrite facts or retrieve more page content.
5. Approve the exact packet. Copy it or open a blank Gemini, ChatGPT or Claude chat, then paste it yourself with page access off.

Task, block, preview or destination changes revoke approval. Captures stay in session memory. Follow-up tasks reuse that snapshot; additional context requires an explicit capture. This is a context bridge, not another assistant.

## Present safely

The on/off switch prepares a tab for presentations or browser recordings. Choose Blur or Hide; credentials always receive Hide. Label-aware form detection covers names, birth dates, personal identifiers, demographics and income, with photos/signatures in recognized forms. Select multiple missed elements in one session, undo the last or clear manual areas. Reports explain covered field types without exposing values. Controls stay outside the shared source page.

Optional per-site reminders ask before observed browser screen capture, allow cancellation, and disappear before capture starts. Enable them on the meeting/recording site, grant its permission and reload it. They cannot detect OBS, native apps or operating-system recording. Screenshot OCR now pairs sensitive labels with values on the same row; exports support opaque Hide and visual Blur.

Entire-screen sharing cannot be selectively filtered by this extension. Share the prepared browser tab or clean snapshot. Desktop protection, IDE integration and folder permissions are future work.

## Install on another computer

Download [PrivacyShield v0.7.3](dist/PrivacyShield-v0.7.3.zip) and extract it. In Chrome, open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose the extracted `extension` folder. Pin the toolbar icon and open a regular webpage. The ZIP includes license notices in its `licenses` folder.

To build from source instead, install Node.js and run:

    npm ci
    npm run build

Then load `dist/extension`. Reload the extension and open webpages after a rebuild. The local preview runs with `npm run dev` at http://127.0.0.1:4317; tab actions require the installed extension. See [the user guide](docs/user-guide.md).

## Optional AI infrastructure

Groq is the internal API processor, not a product mode or the user's AI destination. The configured model is openai/gpt-oss-20b. The private .env is ignored and never bundled. On another machine configure .env.example privately, run node scripts/setup-local.mjs, then npm run api. There is no API-key setup screen in the normal workflow.

The /minimize-context endpoint receives only the consented sanitized task and included sanitized blocks. The /classify-fields endpoint receives only reviewed field labels/IDs; AI can add covers without receiving field values. Origin, payload allowlists, limits, timeouts and response-ID validation protect the boundary. AI processing still discloses those blocks to an external processor; detectors can miss contextual private details. The processor is disclosed inside the optional check and [privacy policy](PRIVACY.md). The local workflow works without the API.

## Verify

    npm run typecheck
    npm run lint
    npm test
    npx playwright install chromium
    npm run test:e2e
    npm run audit:bundle
    npm audit

See [test evidence](docs/test-report.md), [status](IMPLEMENTATION_STATUS.md), [architecture](docs/architecture.md), [complete project document](docs/PrivacyShield_Complete_Project_Document.md) and [services](docs/third-party-services.md). Screenshots use synthetic data.

## Boundaries

Native Ask Gemini cannot be intercepted by this extension. Attaching original tabs or connected accounts in another AI bypasses this reviewed workflow. Extraction, detectors and OCR are imperfect; review is mandatory. PrivacyShield does not guarantee anonymity, prevent all profiling, certify payment gateways or enforce policy across a computer. The implementation follows the current product scope described above.

## Semantic accuracy upgrade (0.7.2)

Present Safely → turn protection on → **Semantic privacy scan** → **Prepare semantic review** → inspect labels and consent → classify → review categories → apply. Uncertain findings need an explicit Protect choice. Optional remembered meanings protect matching future fields locally; clear them in Settings. Existing manual, blur/hide and sharing-reminder workflows remain.

The same optional review is available after context capture in Ask Privately and after local OCR in the screenshot studio. It receives labels with values withheld, never screenshots or the raw page. See [implementation and verification](docs/semantic-engine.md) for exact boundaries, limitations and file changes. Restart the local API after updating. Groq remains the default; `AI_PROVIDER=openrouter` requires an OpenRouter key/model in the private environment. No provider key belongs in the extension.

## Screenshot OCR fix (0.7.3)

Local OCR now reads sparse text in ruled application forms, including separated identifier, name and birth-date cells that the earlier page-layout mode could miss. The image and OCR results stay on device. Photos and signatures are not identified by text OCR; cover them manually and inspect the whole image before exporting.
