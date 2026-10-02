# PrivacyShield — Complete Project Document

**Version:** 0.6.0

**Updated:** 2026-10-02

**Product:** Chrome browser extension

**Core promise:** Useful context for AI. Private boundaries for presentations.

## 1. Vision and origin

PrivacyShield grew from the user's ISRO-inspired private-browser problem statement. Its implementation is an extension so users can keep their existing browser and work habits. It helps users decide what a webpage discloses to another person or AI assistant.

The central problem is excess context: asking an AI to compare products should not require giving it account identity, addresses, cart contents or unrelated browsing history. Presenting a work conversation should not require revealing other contacts, profile pictures or unrelated private fields.

The project preserves that original idea. It does not pivot into another assistant, a payment scanner or a private browser.

## 2. Product scope

Two main capabilities:

1. **Ask privately:** a task-bounded bridge between a webpage and the user's chosen AI.
2. **Present safely:** prepare a browser tab or static snapshot for sharing.

A supporting **Sanitize** studio cleans standalone text and screenshots. It is a utility, rather than the main normal-user value proposition. Settings manage local preferences and optional API access.

Groq is only the AI API processor behind optional task-relevance and private-field-label checks. It is not the user's AI destination, a separate product or an API-connection mode in the normal interface.

This release is extension-only. IDE agents, CLI/MCP integration, folder permissions, native desktop capture and enterprise enforcement are future work. Payment-gateway certification and threat feeds are excluded from the main product.

## 3. Who it helps

| User | Useful task | Information usually unnecessary |
|---|---|---|
| Shopper | Compare product specs/prices | Name, delivery address, cart and history |
| Employee | Explain selected public work content | Account fields, unrelated colleagues, private tokens |
| Developer | Ask about a chosen code/document excerpt | Credentials, account panels and unrelated files |
| Presenter | Show the active work/chat | Other contacts, avatars, sidebar previews and private inputs |
| Support user | Share a reviewed text/image excerpt | Direct identifiers and credentials |

PrivacyShield is a selective disclosure tool. It is not a guarantee that a person is anonymous or that a provider cannot infer anything from useful context.

## 4. Ask privately workflow

### Define the task

The user describes what help is needed before capturing context. That question guides local relevance suggestions. Recognized personal information in the question is also replaced locally.

### Choose a bounded source

- **Element picker:** choose any readable element, including navigation and displayed table values.
- **Text rectangle:** drag around only the visible text you want. Characters outside its bounds are not collected.
- **Explicit page scan:** deliberately read supported page content, then review per-block exclusions.
- **Section picker:** an outline shows the article, product card or paragraph that will be collected. Click to select; Esc/Cancel stops it.
- **Highlighted text:** reads the actual text Range, including partial text-node offsets.
- **Main content:** uses a single readable main region or unambiguous article.
- **Pasted excerpt:** checks only the supplied relevant text.

There is no silent whole-page fallback. Missing, ambiguous, unreadable or oversized scopes fail with an explanatory message. A failed new capture clears the prior packet rather than leaving it ready to release.

Automatic scopes skip supported navigation/account areas; explicit selections can include them. Hidden content, editable input values and unsupported iframe/canvas/video surfaces are skipped. Displayed form values carry their associated labels; recognized private values are locked out of the outgoing packet. It reads no backend database, cookies, input values, webpage API credentials or browser history. Structural exclusion remains heuristic and is not universal.

### Review the boundary

The user sees included and excluded blocks, local recognized-pattern counts and reasons. Public blocks can be toggled. Recognized identity fields and credential blocks are excluded from this handoff. Product headings remain attached to relevant specifications so the AI knows which facts describe which product.

The user can explicitly add another section from the pinned source tab. Captures stay in memory. Task changes and follow-up preparation reuse the snapshot without rereading the page.

### Optional AI relevance check

The included blocks and task are sanitized locally before any optional external check. One-request consent discloses that the configured processor receives this reduced draft. The processor never receives excluded blocks, page URLs, page titles, screenshots or form values through this request.

The AI may return only a subset of supplied block IDs. It cannot rewrite facts, invent content or retrieve more webpage data. The server and extension validate IDs independently. Invalid/empty responses leave the local draft available; the user can reinclude public blocks.

This prevents a model from silently changing product facts. It does not eliminate all privacy risk: unlabeled names or confidential concepts might survive in a chosen block and be seen by the processor.

### Approve the exact handoff

The editable preview shows the sanitized task and selected context together. The user can remove another detail manually, rebuild from selected blocks, and choose Gemini, ChatGPT or Claude.

Only after explicit approval can the packet be copied or copied while opening a blank AI chat. Nothing is placed in the destination URL or automatically submitted. The user pastes it into a new chat with page access off.

Changing task, blocks, preview or destination clears approval. A local output gate rejects recognizable original private values and newly inserted supported secret patterns.

### Native browser AI

A normal extension cannot intercept Chrome's native Ask Gemini button or substitute its internal page context. Attaching the original tab or authorizing connected-account information in the chosen AI bypasses this controlled workflow.

The AI still sees the user's login account and whatever they type or separately authorize. The defensible promise is control over the approved packet, not universal protection against profiling, training, retention or recommendation systems.

## 5. Present safely

The existing presentation capability is retained. The user selects the intended sharing surface, chooses categories, creates a private preview, inspects the source tab and reviews a change report in the extension.

A simple presentation/recording switch prepares the tab. Users choose Blur or Hide: blur signals protected content; hide removes it from view while preserving layout. Credentials always receive Hide. Label-aware scanning protects separate values for personal names, DOB, application/APAAR/Aadhaar identifiers, demographics and family income, plus identifying photos/signatures in recognized personal forms. Reports explain covered field types without disclosing values. Dynamic supported content is rescanned. Manual selection stays active for multiple elements until Escape/Done, with last-area undo, clear manual areas and restoration.

### WhatsApp preset

The preset can blur/hide visible contact/chat names, cover profile images, hide sidebar previews, cover editable fields and replace recognizable private text. Users choose categories. The active conversation remains visible except for recognized private patterns or regions they hide themselves.

### Private controls

The extension does not insert a persistent masking banner or toggle into the shared webpage. Reports and controls stay in its own UI. That UI is not inherently invisible to a meeting capture: entire-screen sharing captures visible windows. Users should share the prepared tab or clean snapshot.

### Optional browser capture reminders

Users enable reminders on a chosen meeting/recording site and grant that site access. A preflight appears before observed getDisplayMedia requests: prepare the actual source tab, continue without protection or cancel. It disappears before capture starts; the native browser chooser remains in control. LIVE/REC badges describe observed capture and MediaRecorder activity. Native apps, OBS, operating-system tools, other recording extensions, unenabled sites and cached/overridden APIs are not universally detected. This advisory hook is not enterprise enforcement. Disabling unregisters scripts and cleans reachable tabs; optional site grants remain until revoked in Chrome.

### Clean meeting snapshot

Reviewed text can be sent to an isolated meeting tab through an in-memory, identity-checked handshake. It contains only the approved text, not a live webpage mirror. Users share that tab in their meeting.

### Desktop limitation

A browser extension cannot selectively remove native meeting windows, operating-system notifications or other applications from entire-screen sharing. Full desktop filtering requires a future native capture pipeline. Frames, images, canvas, video and closed shadow roots need separate review.

## 6. Supporting text and screenshot tools

Standalone text uses deterministic local detectors, consistent replacements, editable review and a guarded clipboard action. Balanced/Strict policies apply here. Ask privately uses conservative neutral replacements independently.

Screenshot import/capture runs packaged English OCR locally. Sensitive OCR labels also cover values in separate blocks on the same row. Suggested covers can be supplemented with multiple rectangles. Users choose Blur or opaque Hide; credential rows remain opaque. Zero findings is not a safety result. The exported PNG contains altered pixels, rather than removable HTML overlays. OCR failure leaves manual review available; unreviewed export remains disabled.

Original screenshots are not sent to the processor. OCR accuracy is imperfect and users must inspect every pixel.

## 7. Privacy and decisions

The user's final decision governs the outgoing packet. AI proposes less context; it does not authorize disclosure. Supported recognized credentials remain blocked. There is no raw-share bypass inside Ask privately.

Initial local scanning means running ordinary detection code in the extension on the user's device. It does not mean a cloud model is operating without an API. Its purpose is to avoid sending the raw page to a cloud model merely to decide which parts are private.

The optional AI step adds semantic relevance checking after that boundary. Presentation field review sends inspected generalized/sanitized labels and IDs only; it can add covers without sending values, photos or screenshots. Labels can carry confidential context and require consent. Because it is still external processing, the user inspects the reduced draft before consenting.

No content, page URL or destination history is persisted by these workflows. Preferences and an optional aggregate counter can be stored locally. Opt-in reminder site patterns and granted permissions persist as Chrome configuration, rather than browsing history. Clear sessions and separately manage clipboard/downloaded copies.

## 8. Technical architecture

| Component | Role |
|---|---|
| React/TypeScript extension | Toolbar, side panel, review, presentation setup, supporting studio |
| context-capture | Isolated scoped DOM capture and picker |
| context-core | Pure task/block preparation, packet gate, subset validation |
| privacy-core | Local patterns, overlap handling, replacements and output validation |
| field-core / page-fields | Sensitive-label classification, associated DOM values and OCR row geometry |
| Site-scoped capture monitor | Opt-in preflight, fresh continuation click, cancellation and browser-capture/recording state |
| Presentation content script | Visual masks, site preset, mutation rescans and restoration |
| Sharing module | Reviewed clipboard handoff and isolated meeting handshake |
| Local Node backend | Consented AI API adapter; no webpage access |
| Packaged OCR | English worker, WASM and language data |
| Test suite | Local/API boundaries plus installed-extension browser behavior |

The MV3 permissions are activeTab, scripting, storage, sidePanel and clipboardWrite, plus optional loopback host access for the backend and optional chosen-site HTTP(S) access for capture reminders. The production manifest has no required all-site host access or broad history/cookie/debugger permissions. The API key remains outside the bundle in private environment configuration.

## 9. AI API contract

The new /minimize-context endpoint accepts only consent, purpose and unique sanitized blocks. The backend checks exact extension Origin, payload keys, direct private patterns, sizes, rate limits and timeout. The provider returns keepIds; both layers reject invented, duplicated or already excluded IDs.

The current configured processor is Groq with openai/gpt-oss-20b. Quotas and provider terms apply. Provider selection is infrastructure configuration; the normal user chooses the destination assistant separately.

Legacy review/explanation routes remain for compatibility and are outside the new interface. The /classify-fields endpoint accepts reviewed labels/IDs and returns only existing privateIds, with consent/origin/schema/size/response validation. No screenshot processing or whole-page remote scan is included.

## 10. User experience

The visual language uses graphite, warm ivory, forest green and custom redaction bars. There are no robot illustrations, blue AI gradients, invented security scores or live threat theatrics.

The normal path is task → scope → boundary review → exact approval. Include/exclude counts and reasons explain what is being withheld and why that reduces exposure. Native browser and desktop limitations appear beside the relevant actions.

The responsive panel supports narrow browser layouts. Controls, consent and copying are keyboard-addressable. Automated accessibility checks are evidence, not a certification.

## 11. Verification and evidence

The release includes unit/API tests for private-field exclusion, task relevance, heading relationships, task sanitization, unsafe output, size boundaries, origin/schema validation and malicious AI IDs.

Installed-extension tests cover real scoped injection, partial Range capture, no whole-page fallback, cancelled picking, stale/frozen packets, clipboard canaries, approval revocation, blank Gemini handoff, optional reduced-block AI checking, responsive layout, accessible initial dashboard, presentation masking, WhatsApp names, dynamic fields/shadow roots, meeting snapshots and local OCR exports.

A live synthetic AI request verified connectivity and returned only the two product-block IDs, excluding a cookie footer. It did not use the user's real page or personal data.

Exact results, browser version and current counts are in docs/test-report.md and the screenshot evidence. Real toolbar gestures, native permission prompts, assistive technology and broad website compatibility still need manual/user testing.

## 12. Differentiation and validation

The distinctive combination is **task-bounded context sharing plus presentation privacy** in an existing browser. The value is visible selective disclosure: users understand both what an AI receives and what an audience sees.

This is a credible hackathon/catalog prototype, not proven business demand. Validate willingness to use/pay with developers, support teams, consultants and people who regularly share work screens. Compare task quality using reduced context against a baseline, and measure whether users understand the privacy boundary.

Possible future paid capabilities include team-configured rules, centrally managed approved destinations, redaction templates and local-only audit metadata. These require policy/enforcement engineering and user validation rather than marketing claims.

## 13. Roadmap

**Next:** broaden multilingual form layouts, OCR accuracy and real meeting-site reminder/manual validation; improve structural adapters on real shopping/document sites, multilingual privacy detection, user-selected semantic boundaries and broader accessibility/manual browser testing.

**Later:** browser-level team policies and managed distribution, with careful separation of a user's consent from organizational requirements.

**Future separate integration:** CLI/MCP or IDE controls over agent-accessible folders/files, and a native presentation capture pipeline. These are not present in this extension release.

Do not reintroduce payment certification merely to increase feature count. Concentrate on whether users can complete their actual AI/presentation task with materially less unnecessary disclosure.

## 14. Install and demonstrate

Run npm run build, load dist/extension in Chrome Developer mode and launch from a regular webpage. Run npm run dev for the local design/demo preview, and npm run api for the optional configured processor.

Begin with the synthetic shopping example: useful laptop facts retained, private account details excluded, exact preview approved, blank chosen-AI chat opened. Then demonstrate private tab presentation and the WhatsApp preset. The user guide and hackathon demo provide the detailed steps.

PrivacyShield's current promise is specific: **the user controls the reviewed context packet and prepares supported tab content for sharing, while keeping unrelated private details out of those workflows.**
