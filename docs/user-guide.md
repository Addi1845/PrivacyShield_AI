# User guide — 0.6.0

## Install or reload

Run npm run build. In chrome://extensions, enable Developer mode and load dist/extension, or reload the installed extension. **Reload source and meeting webpages too** so older content scripts are removed. Pin PrivacyShield and launch it from a normal webpage. Restricted browser pages are unsupported.

## Protect a presentation or recording

1. Open the actual tab you intend to show. Use the popup's **Privacy on this tab** switch for quick protection, or choose **Present this tab safely** for full controls.
2. Turn on **Presentation / recording privacy**. Choose **Blur** to leave an obvious protected area, or **Hide** to remove content from view while keeping the layout. Credentials are hidden in either mode.
3. Choose categories and select **Update private preview** after changing categories. Supported label/value pairs cover names, birth dates, application/APAAR/Aadhaar identifiers, demographics, income and contact details. Photos/signatures in recognized personal forms are also covered when images are enabled. The private report explains covered field types without showing their values.
4. Inspect the actual source tab. Choose **Select an area to hide**, then click as many elements as needed. Selection stays active until **Escape** or **Done selecting**. **Undo last area** restores one manual selection; **Clear manual areas** restores all manual selections. Automatic protection remains. Manual areas use your Blur/Hide choice.
5. Confirm the inspected tab and select that browser tab in your meeting or recording tool. Turn protection off to restore supported content. New supported DOM content is rescanned, but a short appearance before rescanning is possible.

WhatsApp's preset covers contact/chat names, profile images, sidebar previews, editable fields and detected private text. Inspect the conversation body yourself. Arbitrary names, images, frames, canvas/video and closed shadow roots can be missed.

A clean meeting snapshot is a separate static tab containing only approved text. It is not a live mirror. Entire-screen sharing can expose other windows, notifications and the extension panel; the extension cannot selectively filter a desktop.

## Automatic reminders before browser capture

Enable **Automatic sharing reminders on this site** on the meeting/recording website and grant that site's optional permission. Reload it to catch early capture calls. When that page requests browser screen capture, a dialog asks you to prepare the source tab, continue without protection or cancel.

Prepare the tab you actually intend to show through its toolbar, return to the requesting page, inspect it and continue. **Continue with prepared tab** requires your inspection checkbox. The reminder disappears before the browser capture starts, and the native browser chooser still decides the source. It does not know which tab you will select and does not protect another tab automatically.

LIVE/REC badges describe observed capture/recording activity, not a safety certification. Native apps, OBS, Windows recording and every other recording extension cannot be detected. The setting applies to the enabled site only. Turn it off to remove hooks from that site's reachable tabs; revoke retained site permission in Chrome if desired.

## Optional AI review of private field types

With presentation protection active, expand **AI review of this page's field types**, then **Read field labels for review**. Inspect the exact list, consent once and select **Check field privacy with AI**. Only reviewed labels/IDs go to the configured API processor; field values, screenshots and photos stay local. AI can add covers for less familiar field types. It cannot unmask recognized fields. Inspect the page again. If the API fails, local masks remain.

## Ask AI privately

1. Enter **Your question** before collecting context.
2. Choose **Pick any element**, **Choose a section**, **Use highlighted text**, **Drag an area**, **Find main content**, **Scan this page**, or **Paste an excerpt**. Click selectors target readable elements, including navigation and displayed form text. Rectangle selection includes only text within its bounds. Images and PDFs rendered in canvas need screenshot/OCR/manual review instead.
3. Review included/excluded blocks and the **AI-safe preview**. Values associated with sensitive labels are excluded even when their text alone looks ordinary. Public blocks can be included; recognized private/credential fields stay locked. **Add a section** explicitly adds from the pinned source tab.
4. Edit the preview or remove a highlighted detail. Optional **AI relevance check** sees only consented, locally reduced task/blocks and returns a subset. Review again afterwards.
5. Choose Gemini, ChatGPT or Claude and approve the exact packet. Copy or open a blank chat, then paste and submit yourself. Keep original-page access off.

The selection never silently falls back to the whole page. Page scan is a separate explicit action. Task changes reuse the frozen capture. Capture/preview/block/destination changes revoke approval. Clear session discards in-memory content. The extension cannot intercept the native Ask Gemini button or connected-account access.

## Screenshot studio

Import PNG/JPEG or explicitly capture a granted tab. Packaged English OCR runs locally. It uses sensitive labels and row geometry to cover associated values even when OCR separates them. Select **Hide** for opaque pixels or **Blur** for visual concealment. Credential rows stay opaque. Draw multiple rectangles for missed values, photos and signatures; undo removes the last rectangle. Inspect every pixel and approve before downloading the altered PNG. Zero suggestions means unsupported/missed content, not proof that the image is safe.

The local workflow works without the API. The backend uses the private environment and npm run api. Groq is infrastructure, not an AI destination or separate product mode. No API key is entered into the extension.
