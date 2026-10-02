import { test, expect, chromium } from "@playwright/test";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

test("real page scope picker, no whole-page fallback, frozen context and guarded handoff", async () => {
  const fixture = await mkdtemp(
    resolve(tmpdir(), "privacyshield-context-test-"),
  );

  await cp("dist/extension", fixture, { recursive: true });
  const manifest = JSON.parse(
    await readFile(fixture + "/manifest.json", "utf8"),
  );
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(fixture + "/manifest.json", JSON.stringify(manifest));

  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${fixture}`,
      `--load-extension=${fixture}`,
    ],
    viewport: { width: 1440, height: 1050 },
  });
  try {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker", { timeout: 15000 });

    await worker.evaluate(() => chrome.storage.local.set({ onboarded: true }));
    await context.route("http://127.0.0.1:4317/demo/context", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SECRET_PROJECT_TITLE_CANARY</title><style>body{font:18px system-ui;margin:35px}section{padding:25px;border:1px solid #ccc;margin:20px}</style></head><body>
      <nav>NAV_CANARY Home Canvas Project</nav><div id="account">ACCOUNT_CANARY Logged in as Private Person</div>
      <main><section id="product-a"><h2>Laptop A</h2><p id="spec">16 GB RAM, 512 GB SSD, ₹52,000.</p><p>Name: Priya Sharma</p><div data-private>UNLABELLED_PRIVATE_CANARY</div></section>
      <section id="product-b"><h2>Laptop B</h2><p>32 GB RAM, 1 TB SSD, ₹67,000.</p></section><p style="opacity:0">HIDDEN_CANARY</p><form><input value="FORM_VALUE_CANARY"><p>FORM_TEXT_CANARY</p></form></main>
      <aside>BROWSING_HISTORY_CANARY</aside><footer>FOOTER_CANARY</footer></body></html>`,
      }),
    );

    const source = await context.newPage();
    await source.goto("http://127.0.0.1:4317/demo/context");

    const tabId = await worker.evaluate(
      async () =>
        (await chrome.tabs.query({})).find((tab) =>
          tab.url?.endsWith("/demo/context"),
        )!.id!,
    );
    const id = new URL(worker.url()).hostname;

    const ui = await context.newPage();
    ui.setDefaultTimeout(15000);
    const errors: string[] = [];
    ui.on("pageerror", (error) => errors.push(error.message));
    const network: string[] = [];
    ui.on("request", (request) => {
      if (request.url().startsWith("http"))
        network.push(request.url() + (request.postData() ?? ""));
    });
    await ui.goto(`chrome-extension://${id}/index.html?targetTab=${tabId}`);
    await ui
      .getByLabel("Your question")
      .fill("Compare laptops for coding under ₹70,000.");
    await ui.getByRole("button", { name: "Find main content" }).click();
    const preview = ui.getByLabel("AI-safe preview");
    await expect(preview).toHaveValue(/16 GB RAM/);
    const initial = await preview.inputValue();
    for (const excluded of ["CANARY", "Priya", "Canvas", "Private Person"])
      expect(initial).not.toContain(excluded);
    expect(initial).toContain("₹67,000");
    await expect(
      ui.getByRole("checkbox", { name: "Include block 3", exact: true }),
    ).toBeDisabled();
    // Page mutations and follow-up tasks cannot silently pull more page data.
    await source.locator("#spec").evaluate((node) => {
      node.textContent = "MUTATED_PRIVATE_CANARY";
    });
    await ui
      .getByLabel("Your question")
      .fill("Explain the RAM tradeoff for these laptops.");
    await expect(preview).toHaveValue(/16 GB RAM/);
    expect(await preview.inputValue()).not.toContain("MUTATED_PRIVATE_CANARY");
    await ui
      .getByRole("checkbox", { name: "I approve this exact context" })
      .check();
    await ui.getByLabel("Your AI").selectOption("Claude");
    await expect(
      ui.getByRole("checkbox", { name: "I approve this exact context" }),
    ).not.toBeChecked();
    await expect(
      ui.getByRole("button", { name: "Open Claude" }),
    ).toBeDisabled();
    // A real chooser collects the outlined card, not the entire surrounding main.
    await source.locator("#spec").evaluate((node) => {
      node.textContent = "16 GB RAM, 512 GB SSD, ₹52,000.";
    });
    await ui.getByRole("button", { name: "Choose a section" }).click();
    await expect(
      source.locator("#privacyshield-context-picker"),
    ).toBeAttached();
    await source.locator("#product-a h2").click();
    await expect(source.locator("#privacyshield-context-picker")).toHaveCount(
      0,
    );
    await expect(preview).toHaveValue(/16 GB RAM/);
    expect(await preview.inputValue()).not.toContain("Laptop B");
    await ui.getByRole("button", { name: "Add a section" }).click();
    await expect(
      source.locator("#privacyshield-context-picker"),
    ).toBeAttached();
    await source.locator("#product-b h2").click();
    await expect(preview).toHaveValue(/32 GB RAM/);
    await ui.screenshot({
      path: "docs/screenshots/context-boundary.png",
      fullPage: true,
    });
    // No existing text selection: don't reuse the old packet or fall back to body.
    await source.evaluate(() => window.getSelection()?.removeAllRanges());
    await ui.getByRole("button", { name: "Use highlighted text" }).click();
    await expect(ui.getByRole("status")).toContainText(
      "Highlight the exact text",
    );
    await expect(preview).toHaveCount(0);
    // Select part of one text node; collection is bounded by the actual Range.
    await source.evaluate(() => {
      const node = document.querySelector("#spec")!.firstChild!;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 9);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await ui.getByRole("button", { name: "Use highlighted text" }).click();
    await expect(preview).toHaveValue(/16 GB RAM/);
    expect(await preview.inputValue()).not.toContain("512 GB");
    await source.evaluate(() =>
      document
        .querySelector("main")!
        .replaceWith(...document.querySelector("main")!.childNodes),
    );
    await ui.getByRole("button", { name: "Find main content" }).click();
    await expect(ui.getByRole("status")).toContainText(
      "no unambiguous main content",
    );
    await expect(preview).toHaveCount(0);
    expect(network).toEqual([]);
    await ui.getByRole("button", { name: "Choose a section" }).click();
    await expect(
      source.locator("#privacyshield-context-picker"),
    ).toBeAttached();
    await source.keyboard.press("Escape");
    await expect(source.locator("#privacyshield-context-picker")).toHaveCount(
      0,
    );
    await expect(ui.getByRole("status")).toContainText("cancelled");
    await expect(preview).toHaveCount(0);
    const stored = await worker.evaluate(async () =>
      JSON.stringify(await chrome.storage.local.get(null)),
    );
    expect(stored).not.toContain("CANARY");
    expect(stored).not.toContain("Priya");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
