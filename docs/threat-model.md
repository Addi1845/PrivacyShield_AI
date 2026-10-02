# Threat model and residual risk — 0.6.0

| Threat | Control | Residual risk |
|---|---|---|
| Excess page context disclosed | Explicit scope; structural exclusions; task-based block review; exact outgoing preview | Misclassified page regions or unlabeled confidential facts may remain |
| Raw page disclosed to privacy-checking AI | Local first pass; only consented included sanitized blocks and task accepted | Unrecognized private context in those blocks reaches the processor |
| AI changes facts or invents content | Provider returns only existing block IDs; server/client validate; original facts copied from local snapshot | AI may choose an unsafe or incomplete subset; review remains necessary |
| Old snapshot released after failure | Capture failures clear new-packet state; approval revocation; generation checks; aborted requests | User can separately share an old clipboard copy |
| New private text inserted | Preview edits clear approval; final detected-original and secret validation | Novel private formats and arbitrary names may be missed |
| Page prompt injection | Treat page instructions as data; no model tools; subset allowlist; no HTML rendering | Classification can still be manipulated; no claim of perfect prompt-injection prevention |
| Context captured from wrong page | Session pins source tab; adding context explicit; no silent reread | A captured source tab can navigate before another authorized capture; users inspect every draft |
| Presentation leak | Category controls, mutation rescans, manual areas, private report and clean snapshot | Rescan flashes, unsupported surfaces, native windows and entire desktops remain outside coverage |
| Screenshot disclosure | Altered raster export; opaque credential rows; explicit Blur/Hide choice | Blur can leave clues; missed pixels or nontext features remain |
| Private form values missed | Label-aware DOM and OCR row detection; optional label-only AI; manual multi-selection | Unknown layouts/labels/languages and photos may still be missed |
| AI field review discloses values | Inspected label-only schema, consent and nonce-bound returned IDs | Unknown labels can themselves reveal private context; pairing can be imperfect |
| Recording starts without preparation | Opt-in site preflight, explicit continuation/cancellation and native source chooser | Cached APIs, page tampering, unsupported frames/native apps/other recorders bypass reminders |
| Key disclosure | Backend-only private environment, bundle audit, generic errors | Local filesystem/process compromise outside this prototype |
| Backend misuse | Loopback, exact Origin, strict keys, bounded blocks, rate limit and timeout | Native local processes can forge Origin; not an authenticated multiuser service |
| Processor unavailable | Local packet remains usable; visible failure; no approval bypass | Semantic suggestions unavailable |
| Native AI bypass | Clear handoff guidance; blank-chat copy/open | Original-tab sharing, connected accounts, later typed details and provider policies are outside control |

Blur can leave visual clues. Hide preserves geometry but removes content from view. No zero-frame guarantee is made for dynamic content. Visual tab masking is not encryption or removal from the source website. Browser memory clearing is best effort, not secure erasure. Clipboard and downloaded exports have separate retention. This is a personal/hackathon prototype, not audited enterprise DLP or a universal privacy guarantee.
