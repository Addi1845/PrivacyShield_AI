# Security notes

This is an unpacked personal/hackathon prototype, not a Chrome Web Store release or audited enterprise DLP product. Report defects privately to the project maintainer with synthetic reproduction data. Never put real keys, screenshots, personal records or original private text into an issue or log.

API keys belong only in the ignored root .env file. Replace or revoke a key if shared in a chat or other unintended location. Do not package .env, browser profiles, node_modules or personal test data for distribution. The only distributable extension is dist/extension; optional backend setup requires the user's own environment.

Treat the clean meeting tab as a reviewed snapshot, not a secure virtual display. Share only that tab. Entire-screen and window sharing can expose other applications, notifications and browser UI. Chrome's native Ask Gemini is outside extension control; use the reviewed clipboard handoff and disable Gemini's default current-tab sharing.

Run build, lint, typecheck, unit tests, browser tests, npm audit and the bundle audit before release. Keep lockfile and dependency versions reviewed. Do not add telemetry, remote scripts, broad host permissions or raw-content backend endpoints without revisiting the architecture and consent design.
