# Third-party dependencies and services

## Network inventory

| Destination | Trigger | Payload |
|---|---|---|
| Local port 4318 /minimize-context | One-request consent after inspecting the reduced draft | Sanitized purpose and included blocks: id + sanitized text |
| Local port 4318 /classify-fields | Consent after viewing exact label list | Field IDs and reviewed/generalized labels; no field values |
| Groq chat/completions API | Validated local request | Reduced purpose/blocks or reviewed labels, fixed system instructions and configured model |
| Gemini / ChatGPT / Claude websites | Approved copy/open handoff | Blank destination URL; no prompt request or URL content |
| Local port 4317 /receive | Synthetic demo form submission | Explicitly pasted sanitized text; no cloud forwarding |

Legacy /review-context accepts consented sanitized text/purpose and /explain accepts fixed finding codes; neither is connected to the new Ask privately interface.

All OCR workers, English language data, WASM, icons and app code are bundled. There are no CDN, analytics, telemetry or automatic threat requests. The demo receiver is local and uses synthetic data.

## Internal AI processor

Groq is the API infrastructure selected for this workspace. The adapter currently uses openai/gpt-oss-20b through the OpenAI-compatible Groq endpoint; it does not require an OpenAI, Gemini or xAI key. A historical live synthetic /minimize-context request returned HTTP 200 and retained the two specification blocks while excluding a cookie footer. This verifies connectivity, not detection accuracy or provider retention.

Credentials reside only in private .env/backend memory. The provider is disclosed before optional processing and in the privacy policy. Unrecognized sensitive context can remain in the consented draft. Account quotas and service terms apply; no unlimited-free, zero-retention or anonymity promise is made.

References: [interface](https://console.groq.com/docs/openai), [model](https://console.groq.com/docs/model/openai/gpt-oss-20b), [limits](https://console.groq.com/docs/rate-limits), [data policy](https://console.groq.com/docs/your-data).

## Bundled libraries

React/React DOM and tldts supply MIT licenses; Lucide icons use ISC. Tesseract.js and its core supply Apache-2.0 licenses. License files are copied to dist/licenses where packages provide them. Review upstream language-data notices and the locked dependency inventory before publication. Development tooling is not loaded into the extension.

This prototype has not been published to an extension store.
