# Implementation status

Updated 2026-10-02 — **0.6.0**. Browser-extension scope: task-bounded AI context and private presentations/recordings. Later user instructions govern implementation; the original PRD remains for traceability.

## Delivered

- Exact element, section, highlighted Range, dragged text rectangle, explicit page scan, main-content and pasted-excerpt captures. No silent whole-page fallback.
- Label-aware private-value exclusion for displayed form tables, including names, dates, identifiers, demographics and family income; readable public form facts remain usable.
- Frozen captures, per-block review, editable packet, user approval/revocation and blank chosen-AI handoff.
- Optional reduced-block AI relevance and reviewed labels-only AI field classification. Strict origin/schema/consent/ID boundaries; no raw screenshot or private field-value upload.
- Presentation/recording on/off switch and popup shortcut; Blur and Hide treatments; credentials hidden regardless of Blur.
- Repeated manual selections, last-area undo, clear manual areas, category controls, dynamic rescans and restoration.
- WhatsApp preset; identifying photos/signatures in recognized personal forms; private category report and isolated meeting snapshots.
- Opt-in site-scoped capture preflight; user cancellation/continuation; prompt removed before stream starts; LIVE/REC state for observed browser capture/MediaRecorder activity.
- Packaged local OCR now covers associated label/value rows; screenshot Blur/Hide and reviewed PNG export.
- Graphite/ivory/green responsive UI. Groq remains optional backend infrastructure.

## Boundaries

No native browser AI interception, universal screen-recording detection, desktop filtering, backend inspection, IDE/folder enforcement, payment certification or store publication. Blur is visual and weaker than Hide; source DOM values remain accessible to the source site. Unsupported images/frames/canvas and arbitrary private facts can be missed. Review is necessary.

Real toolbar gestures, native permission/source-picker dialogs, other browsers and assistive technology require manual validation. Automated injection/reminder tests use a temporary localhost-granted package; production has no required host access. Current evidence is in docs/test-report.md; it is not a population-level accuracy guarantee.

Loadable build: dist/extension. Reload the extension and source/meeting tabs after updating.
