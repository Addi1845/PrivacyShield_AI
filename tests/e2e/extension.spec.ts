import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { resolve } from "node:path";
import { mkdir, writeFile, readFile, cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import AxeBuilder from "@axe-core/playwright";
let context: BrowserContext, id: string, page: Page;
test.beforeAll(async () => {
  const extension = resolve("dist/extension");
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
    viewport: { width: 1440, height: 1050 },
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  id = new URL(worker.url()).hostname;
  await mkdir("docs/screenshots", { recursive: true });
  await writeFile(
    "docs/browser-test-runtime.json",
    JSON.stringify(
      {
        browser: context.browser()?.version(),
        extensionId: id,
        date: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  page = await context.newPage();
  await page.goto(`chrome-extension://${id}/index.html`);
  await page.getByRole("button", { name: "Get started" }).click();
});
test.afterAll(async () => {
  await context?.close();
});
test("extension shell, guarded copy, clipboard and no-leak receiver", async () => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const network: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("http"))
      network.push(r.url() + (r.postData() ?? ""));
  });
  await page.getByRole("button", { name: "Try a shopping example" }).click();
  await expect(
    page.getByRole("button", { name: "Copy approved context" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "I approve this exact context" })
    .check();
  await page.getByRole("button", { name: "Copy approved context" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Approved context copied",
  );
  const demo = await context.newPage();
  await demo.goto("http://127.0.0.1:4317/demo/presentation");
  await demo.getByLabel("Demo receiver input").focus();
  await demo.keyboard.press("Control+V");
  const copied = await demo.getByLabel("Demo receiver input").inputValue();
  expect(copied).not.toContain("demo_sensitive_token");
  expect(copied).not.toContain("aditya@example.com");
  expect(copied).toContain("₹52,000");
  const request = demo.waitForRequest((r) => r.url().endsWith("/receive"));
  await demo.getByRole("button", { name: "Send to local demo" }).click();
  expect((await request).postData()).not.toContain("demo_sensitive_token");
  await expect(demo.locator("#received")).toContainText("₹52,000");
  await demo.close();
  expect(network.join("")).not.toContain("demo_sensitive_token");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/text-review.png",
    fullPage: true,
  });
  await page
    .getByLabel("AI-safe preview")
    .fill(copied + " password: NEW_SECRET");
  await page
    .getByRole("checkbox", { name: "I approve this exact context" })
    .check();
  await expect(
    page.getByRole("button", { name: "Copy approved context" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test("privacy mode: mask, mutation, manual hide, restore and screenshot", async () => {
  const demo = await context.newPage();
  await demo.goto("http://127.0.0.1:4317/demo/presentation");
  await demo.screenshot({
    path: "docs/screenshots/presentation-before.png",
    fullPage: true,
  });
  // Exercise packaged content bundle on a controlled page. Permission handling is a separate test.
  await demo.addScriptTag({
    content: await readFile("dist/extension/content.js", "utf8"),
  });
  await expect(demo.locator("#customer")).not.toContainText(
    "aditya@example.com",
  );
  await expect(demo.locator("#customer")).not.toContainText(
    "demo_sensitive_token",
  );
  await expect(demo.locator("#privacyshield-banner")).toHaveCount(0);
  await expect(demo.locator("body")).not.toContainText("MEETING MASK ON");
  await demo.getByRole("button", { name: "Insert new customer email" }).click();
  await expect(demo.locator("#dynamic")).not.toContainText("fresh@example.com");
  await expect(demo.locator("#dynamic")).toContainText("@example.com");
  await demo.screenshot({
    path: "docs/screenshots/presentation-masked.png",
    fullPage: true,
  });
  await demo.evaluate(() => window.__privacyShield?.pick());
  await demo.locator("#customer h2").click();
  await expect(demo.locator("#customer h2")).toBeHidden();
  await demo.evaluate(() => window.__privacyShield?.undoManual());
  await expect(demo.locator("#customer h2")).toBeVisible();
  await demo.evaluate(() => window.__privacyShield?.stop());
  await expect(demo.locator("#customer")).toContainText("aditya@example.com");
  await expect(demo.locator("#dynamic")).toContainText("fresh@example.com");
  await demo.close();
});
test("WhatsApp preset anonymizes contacts without adding shared controls", async () => {
  await context.route("https://web.whatsapp.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body>
        <div id="pane-side"><div data-testid="cell-frame-container">
          <img id="sidebar-avatar" alt="Diya profile">
          <span data-testid="cell-frame-title" title="Diya Didi">Diya Didi</span>
          <span data-testid="cell-frame-secondary">Private sidebar preview</span>
        </div></div>
        <header><img id="header-avatar" alt="Diya profile"><span data-testid="conversation-info-header-chat-title" title="Diya Didi">Diya Didi</span></header>
        <main id="chat">Project status is ready to share.</main><input aria-label="Search">
      </body></html>`,
    }),
  );
  const whatsapp = await context.newPage();
  await whatsapp.goto("https://web.whatsapp.com/");
  await whatsapp.addScriptTag({
    content: await readFile("dist/extension/content.js", "utf8"),
  });
  await expect(whatsapp.locator("[data-testid='cell-frame-title']")).toHaveText(
    "Maya Shah",
  );
  await expect(
    whatsapp.locator("[data-testid='cell-frame-title']"),
  ).toHaveAttribute("title", "Maya Shah");
  await expect(
    whatsapp.locator("[data-testid='conversation-info-header-chat-title']"),
  ).toHaveText("Maya Shah");
  await expect(whatsapp.locator("#sidebar-avatar")).toBeHidden();
  await expect(whatsapp.locator("#header-avatar")).toBeHidden();
  await expect(
    whatsapp.locator("[data-testid='cell-frame-secondary']"),
  ).toBeHidden();
  await expect(whatsapp.getByLabel("Search")).toBeHidden();
  await expect(whatsapp.locator("body")).not.toContainText("MEETING MASK ON");
  const report = await whatsapp.evaluate(() =>
    window.__privacyShield?.report(),
  );
  expect(report?.site).toBe("whatsapp");
  expect(report?.contactNames).toBeGreaterThanOrEqual(2);
  await whatsapp.evaluate(() => window.__privacyShield?.stop());
  await expect(whatsapp.locator("[data-testid='cell-frame-title']")).toHaveText(
    "Diya Didi",
  );
  await expect(
    whatsapp.locator("[data-testid='cell-frame-title']"),
  ).toHaveAttribute("title", "Diya Didi");
  await whatsapp.close();
  await context.unroute("https://web.whatsapp.com/**");
});
test("screenshot OCR stays local; manual rectangle exports opaque pixels", async () => {
  await page.getByRole("button", { name: "Sanitize", exact: true }).click();
  await page.getByRole("button", { name: "Screenshot", exact: true }).click();
  const fixture = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 300;
    const x = c.getContext("2d")!;
    x.fillStyle = "white";
    x.fillRect(0, 0, 1000, 300);
    x.fillStyle = "black";
    x.font = "32px Arial";
    x.fillText("Contact: alice@example.com", 40, 75);
    x.fillText("Public project summary", 40, 160);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Import screenshot").setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  });
  await expect(page.getByLabel("Screenshot redaction canvas")).toBeVisible();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("http")) requests.push(r.url());
  });
  await page.getByRole("button", { name: "Scan with local OCR" }).click();
  await expect(page.getByRole("status")).toContainText(
    "sensitive lines suggested",
    { timeout: 90000 },
  );
  expect(requests).toEqual([]);
  const canvas = page.getByLabel("Screenshot redaction canvas");
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 150, bounds.y + 60);
  await page.mouse.up();
  await page
    .getByRole("checkbox", { name: "I inspected the whole image" })
    .check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download redacted PNG" }).click();
  const file = await download;
  await file.saveAs("docs/screenshots/redacted-export.png");
  const pixel = await page.evaluate(() =>
    Array.from(
      document
        .querySelector("canvas")!
        .getContext("2d")!
        .getImageData(50, 40, 1, 1).data,
    ),
  );
  expect(pixel).toEqual([16, 20, 18, 255]);
  const exported = (
    await readFile("docs/screenshots/redacted-export.png")
  ).toString("base64");
  const exportedPixel = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = "data:image/png;base64," + data;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(50, 40, 1, 1).data);
  }, exported);
  expect(exportedPixel).toEqual([16, 20, 18, 255]);
  await page.screenshot({
    path: "docs/screenshots/screenshot-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Clear image" }).click();
  expect(
    await page
      .locator("canvas")
      .evaluate((c) => (c as HTMLCanvasElement).width),
  ).toBe(0);
});
test("responsive dashboard and restricted-page permission error", async () => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .getByRole("button", { name: "Ask privately", exact: true })
    .click();
  await page.screenshot({
    path: "docs/screenshots/sidepanel.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Present safely", exact: true })
    .click();
  await page.getByRole("button", { name: "Create private preview" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Open a regular website",
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
});
test("real isolated injection with localhost-only test fixture grant", async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), "privacyshield-test-"));
  await cp("dist/extension", fixture, { recursive: true });
  const manifest = JSON.parse(
    await readFile(fixture + "/manifest.json", "utf8"),
  );
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(fixture + "/manifest.json", JSON.stringify(manifest));
  const isolated = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${fixture}`,
      `--load-extension=${fixture}`,
    ],
  });
  try {
    let [w] = isolated.serviceWorkers();
    w ??= await isolated.waitForEvent("serviceworker");
    const demo = await isolated.newPage();
    await demo.goto("http://127.0.0.1:4317/demo/presentation");
    const tabId = await w.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((t) => t.url?.includes("/demo/presentation"))!.id!;
    });
    await w.evaluate(async (tabId) => {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    }, tabId);
    await expect(demo.locator("#customer")).not.toContainText(
      "demo_sensitive_token",
    );
    await w.evaluate(async (tabId) => {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    }, tabId);
    await expect(demo.locator("#customer")).toContainText(
      "demo_sensitive_token",
    );
  } finally {
    await isolated.close();
  }
});
test("accessible dashboard and popup", async () => {
  await page.goto(`chrome-extension://${id}/index.html`);
  await page.screenshot({
    path: "docs/screenshots/dashboard.png",
    fullPage: false,
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  await writeFile(
    "docs/accessibility-results.json",
    JSON.stringify(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
      null,
      2,
    ),
  );
  expect(results.violations).toEqual([]);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.setViewportSize({ width: 380, height: 660 });
  await popup.screenshot({
    path: "docs/screenshots/popup.png",
    fullPage: true,
  });
  await popup.close();
});
test("OCR failure exposes manual review and blocks unreviewed export", async () => {
  const editor = await context.newPage();
  await editor.goto("http://127.0.0.1:4317/index.html?tool=image");
  await editor.getByRole("button", { name: "Screenshot", exact: true }).click();
  await editor.getByLabel("Import screenshot").setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: await readFile("apps/extension/public/icons/icon128.png"),
  });
  await editor.route("**/ocr/eng.traineddata.gz", (route) =>
    route.fulfill({ status: 500, body: "Unavailable fixture" }),
  );
  await editor.getByRole("button", { name: "Scan with local OCR" }).click();
  await expect(editor.getByRole("status")).toContainText(
    "Review image manually",
    { timeout: 70000 },
  );
  await expect(
    editor.getByRole("button", { name: "Download redacted PNG" }),
  ).toBeDisabled();
  await expect(editor.getByLabel("Screenshot redaction canvas")).toBeVisible();
  await editor.close();
});
test("meeting guide explains entire-screen limits and a reviewed snapshot contains no original content", async () => {
  await page.goto(`chrome-extension://${id}/index.html`);
  await page
    .getByRole("button", { name: "Present safely", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My entire screen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Entire-screen sharing cannot be privately filtered.",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/meeting-entire-screen-guide.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Clean text snapshot", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create a clean, static meeting view" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try synthetic sample" }).click();
  await page.getByRole("button", { name: "Scan & sanitize" }).click();
  await expect(page.locator(".finding").first()).toContainText("Aditya");
  await expect(page.locator(".finding").first()).toContainText("Person 1");
  await expect(
    page.getByRole("button", { name: "Open clean meeting tab" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "I approve this exact context" })
    .check();
  const created = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open clean meeting tab" }).click();
  const meeting = await created;
  await expect(meeting.locator("#shared-content")).toContainText("₹2,500");
  const html = await meeting.content();
  expect(html).not.toContain("aditya@example.com");
  expect(html).not.toContain("demo_sensitive_token");
  expect(html).not.toContain("CUST-78291");
  await meeting.screenshot({
    path: "docs/screenshots/meeting-view.png",
    fullPage: true,
  });
  await meeting.getByRole("button", { name: "Clear content" }).click();
  await expect(meeting.locator("#shared-content")).toBeEmpty();
  await meeting.close();
});
test("Gemini handoff copies only reviewed content and opens a URL without a prompt", async () => {
  await page.goto(`chrome-extension://${id}/index.html`);
  await page.getByRole("button", { name: "Try a shopping example" }).click();
  await expect(
    page.getByRole("button", { name: "Open Gemini" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "I approve this exact context" })
    .check();
  await context.route("https://gemini.google.com/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><title>Stub Gemini destination</title><p>No real AI request made by this test.</p></html>",
    }),
  );
  const created = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open Gemini" }).click();
  const gemini = await created;
  await gemini.waitForURL("https://gemini.google.com/app");
  expect(new URL(gemini.url()).search).toBe("");
  const demo = await context.newPage();
  await demo.goto("http://127.0.0.1:4317/demo/presentation");
  await demo.getByLabel("Demo receiver input").focus();
  await demo.keyboard.press("Control+V");
  const copied = await demo.getByLabel("Demo receiver input").inputValue();
  expect(copied).toContain("16 GB RAM");
  expect(copied).not.toContain("Priya Sharma");
  expect(copied).not.toContain("demo_sensitive_token");
  expect(copied).not.toContain("aditya@example.com");
  await demo.close();
  await gemini.close();
  await context.unroute("https://gemini.google.com/**");
});
test("internal AI check receives only reduced included blocks and reopens approval", async () => {
  const bridge = await context.newPage();
  await bridge.goto("http://127.0.0.1:4317/index.html?tool=ask");
  await bridge.getByRole("button", { name: "Try a shopping example" }).click();
  let payload = "";
  await bridge.route(
    "http://127.0.0.1:4318/minimize-context",
    async (route) => {
      payload = route.request().postData() ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ keepIds: ["b0"] }),
      });
    },
  );
  await bridge
    .getByText("Optional AI relevance check", { exact: true })
    .click();
  await bridge
    .getByRole("checkbox", { name: "I approve this exact context" })
    .check();
  await bridge
    .getByRole("checkbox", {
      name: "Allow an AI check of these included blocks only",
    })
    .check();
  await bridge.getByRole("button", { name: "Check task relevance" }).click();
  await expect(
    bridge.getByText(
      "AI relevance check removed 1 block. Facts were not rewritten. Review and approve again.",
    ),
  ).toBeVisible();
  expect(payload).toContain("16 GB RAM");
  expect(payload).not.toContain("Priya");
  expect(payload).not.toContain("Private Road");
  expect(payload).not.toContain("demo_sensitive_token");
  await expect(
    bridge.getByRole("checkbox", { name: "I approve this exact context" }),
  ).not.toBeChecked();
  await expect(bridge.getByLabel("AI-safe preview")).not.toHaveValue(
    /Laptop B/,
  );
  await bridge.getByRole("checkbox", { name: "Include block 2" }).check();
  await expect(bridge.getByLabel("AI-safe preview")).toHaveValue(/Laptop B/);
  await bridge.close();
});
test("meeting mask covers split text and fields, restores fields, rescans open shadow roots", async () => {
  const demo = await context.newPage();
  await demo.goto("http://127.0.0.1:4317/demo/presentation");
  await demo.evaluate(() => {
    const p = document.createElement("p");
    p.id = "split-email";
    p.innerHTML = "<span>split@</span><span>example.com</span>";
    document.body.append(p);
    const input = document.createElement("input");
    input.id = "private-field";
    input.value = "DO_NOT_READ_FIELD_CANARY";
    document.body.append(input);
    const host = document.createElement("div");
    host.id = "shadow-host";
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    const value = document.createElement("p");
    value.textContent = "shadow@example.com";
    root.append(value);
  });
  await demo.addScriptTag({
    content: await readFile("dist/extension/content.js", "utf8"),
  });
  await expect(demo.locator("#split-email")).not.toContainText(
    "split@example.com",
  );
  await expect(demo.locator("#private-field")).toBeHidden();
  await expect(demo.locator("#shadow-host p")).not.toContainText(
    "shadow@example.com",
  );
  await demo
    .locator("#private-field")
    .evaluate(
      (el) => ((el as HTMLInputElement).value = "CHANGED_WHILE_MASKED"),
    );
  await demo.evaluate(() => window.__privacyShield?.stop());
  await expect(demo.locator("#split-email")).toHaveText("split@example.com");
  await expect(demo.locator("#private-field")).toBeVisible();
  await expect(demo.locator("#private-field")).toHaveValue(
    "CHANGED_WHILE_MASKED",
  );
  await expect(demo.locator("#shadow-host p")).toHaveText("shadow@example.com");
  await demo.close();
});
