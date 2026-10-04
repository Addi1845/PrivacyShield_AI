import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Worker,
} from "@playwright/test";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
let context: BrowserContext, worker: Worker, extensionId: string;
const html = `<!doctype html><meta charset="utf-8"><style>body{font:20px Arial}section{margin:20px}section>div{padding:8px}</style><main>
<section><div>Profile owner</div><div id="person">SYNTHETIC_PERSON_CANARY</div></section>
<section><div>Employee UID</div><div id="uid">ABC-82931</div></section>
<section><div>नाव</div><div id="marathi">SYNTHETIC_MARATHI_CANARY</div></section>
<section><div>जन्म तिथि</div><div id="hindi">SYNTHETIC_BIRTH_CANARY</div></section>
<section><div>RAM</div><div id="ram">16 GB RAM</div></section>
<section><div>Price</div><div id="price">₹65,000</div></section>
<p id="project">Project Falcon internal review</p><p id="public">Laptop public specifications</p>
<input type="password" value="NEVER_SEND_THIS"><div hidden>HIDDEN_CANARY</div><nav>NAV_CANARY</nav></main>`;
test.beforeAll(async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), "privacyshield-semantic-"));
  await cp("dist/extension", fixture, { recursive: true });
  const manifest = JSON.parse(
    await readFile(fixture + "/manifest.json", "utf8"),
  );
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(fixture + "/manifest.json", JSON.stringify(manifest));
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${fixture}`,
      `--load-extension=${fixture}`,
    ],
  });
  [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  extensionId = new URL(worker.url()).hostname;
  await worker.evaluate(() => chrome.storage.local.set({ onboarded: true }));
  await context.route("http://127.0.0.1:4317/demo/semantic-fixture", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
});
test.afterAll(async () => context?.close());
test("standalone text sanitizer catches compact personal-name labels without AI", async () => {
  const ui = await context.newPage();
  const external: string[] = [];
  ui.on("request", (request) => {
    if (request.url().startsWith("http")) external.push(request.url());
  });
  try {
    await ui.goto(`chrome-extension://${extensionId}/index.html`);
    await ui.getByRole("button", { name: "Sanitize", exact: true }).click();
    await ui
      .getByLabel("Original", { exact: true })
      .fill("Name :Aditya\nProduct name: Laptop\nPrice: ₹65,000");
    await ui.getByRole("button", { name: "Scan & sanitize" }).click();
    await expect(ui.getByLabel("AI-safe preview")).toHaveValue(
      "Name :Person 1\nProduct name: Laptop\nPrice: ₹65,000",
    );
    expect(external).toEqual([]);
  } finally {
    await ui.close();
  }
});
test("card fields tolerate line breaks, helper nodes, links and direct text values", async () => {
  const { page, tabId } = await open();
  try {
    await page.locator("main").evaluate((main) =>
      main.insertAdjacentHTML(
        "beforeend",
        `
      <div><b>Application ID</b><br><a id="card-id" href="#">SYNTHETIC-APP-82931</a><small>Submitted</small></div>
      <div id="card-phone"><strong>Mobile Number.</strong><br>xxxxxx1234</div>
      <div><strong>Assigned consultant</strong><br><span id="card-person">PRIVATE_CONSULTANT_CANARY</span><small>Active</small></div>
      <div><span class="field-label">Beneficiary</span><br><div><span id="nested-person">PRIVATE_BENEFICIARY_CANARY</span></div><small>Verified</small></div>
      <div><b>Price</b><br><span id="card-price">₹65,000</span><small>In stock</small></div>
    `,
      ),
    );
    await expect(page.locator("#card-id")).toHaveCSS("filter", "blur(12px)");
    await expect(page.locator("#card-phone")).toHaveCSS("filter", "blur(12px)");
    const snapshot = await prepare(tabId);
    expect(snapshot.elements.map((e) => e.label)).toEqual(
      expect.arrayContaining(["Assigned consultant", "Beneficiary"]),
    );
    expect(JSON.stringify(snapshot)).not.toContain("CANARY");
    await expect(page.locator("#card-price")).toHaveCSS("filter", "none");
    await worker.evaluate(
      async (tabId) =>
        chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.__privacyShield!.stop(),
        }),
      tabId,
    );
    await expect(page.locator("#card-id")).toHaveCSS("filter", "none");
    await expect(page.locator("#card-phone")).toHaveCSS("filter", "none");
  } finally {
    await page.close();
  }
});
test("OCR semantic review uploads labels only and applies local opaque pixels", async () => {
  const ui = await context.newPage();
  let wire = "";
  await context.route("http://127.0.0.1:4318/classify-elements", (route) => {
    const body = route.request().postDataJSON();
    wire = JSON.stringify(body);
    return route.fulfill({
      json: {
        elements: body.elements.map((e: { id: string }) => ({
          id: e.id,
          category: "PERSON_NAME",
          action: "MASK",
          confidence: 0.97,
        })),
      },
    });
  });
  try {
    await ui.goto(`chrome-extension://${extensionId}/index.html?tool=image`);
    await ui.getByRole("button", { name: "Screenshot", exact: true }).click();
    const image = await ui.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1100;
      canvas.height = 360;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 1100, 360);
      ctx.fillStyle = "black";
      ctx.font = "28px Arial";
      ctx.fillText("Profile owner", 30, 80);
      ctx.fillText("Synthetic Person", 550, 80);
      ctx.fillText("Laptop public specifications", 30, 240);
      return canvas.toDataURL().split(",")[1];
    });
    await ui.getByLabel("Import screenshot").setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
    await ui.getByRole("button", { name: "Scan with local OCR" }).click();
    await expect(
      ui.getByText("Semantic privacy scan", { exact: true }),
    ).toBeVisible({ timeout: 90000 });
    await ui.getByText("Semantic privacy scan", { exact: true }).click();
    await ui.getByRole("button", { name: "Prepare semantic review" }).click();
    await expect(ui.getByText(/e0: Profile owner/)).toBeVisible();
    await ui.getByRole("checkbox", { name: "I reviewed these labels" }).check();
    await ui.getByRole("button", { name: "Classify reviewed labels" }).click();
    await ui.getByRole("button", { name: "Apply reviewed protection" }).click();
    expect(wire).not.toContain("Synthetic Person");
    expect(wire).not.toContain("data:image");
    await expect
      .poll(() =>
        ui.evaluate(() =>
          Array.from(
            document
              .querySelector("canvas")!
              .getContext("2d")!
              .getImageData(560, 70, 1, 1).data,
          ),
        ),
      )
      .toEqual([16, 20, 18, 255]);
    await expect(
      ui.getByRole("button", { name: "Download redacted PNG" }),
    ).toBeDisabled();
  } finally {
    await ui.close();
    await context.unroute("http://127.0.0.1:4318/classify-elements");
  }
});
async function open() {
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4317/demo/semantic-fixture");
  const tabId = await worker.evaluate(
    async () =>
      (await chrome.tabs.query({})).find(
        (t) => t.active && t.url?.endsWith("semantic-fixture"),
      )!.id!,
  );
  await worker.evaluate(async (tabId) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__privacyShield!.configure({ treatment: "blur" }),
    });
  }, tabId);
  return { page, tabId };
}
async function prepare(tabId: number) {
  return worker.evaluate(
    async (tabId) =>
      (
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.__privacyShield!.semanticPrepare(),
        })
      )[0].result!,
    tabId,
  );
}
test("semantic masking uses opaque IDs, preserves public facts, follows dynamic fields, and restores manual masks", async () => {
  const { page, tabId } = await open();
  try {
    await expect(page.locator("#uid")).toHaveCSS("filter", "blur(12px)");
    await expect(page.locator("#project")).toHaveCSS("filter", "blur(12px)");
    const snapshot = await prepare(tabId);
    const wire = JSON.stringify(snapshot);
    for (const forbidden of [
      "CANARY",
      "ABC-82931",
      "NEVER_SEND",
      "<div",
      "http:",
      "selector",
    ])
      expect(wire).not.toContain(forbidden);
    expect(snapshot.elements.map((e) => e.label)).toEqual(
      expect.arrayContaining(["Profile owner", "नाव", "जन्म तिथि"]),
    );
    await worker.evaluate(
      async ({ tabId, snapshot }) => {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (snapshot) =>
            window.__privacyShield!.semanticApply(
              snapshot.nonce,
              {
                elements: snapshot.elements.map((e) => ({
                  id: e.id,
                  category: "PERSON_NAME",
                  action: "MASK",
                  confidence: 0.96,
                })),
              },
              [],
              true,
            ),
          args: [snapshot],
        });
      },
      { tabId, snapshot },
    );
    for (const selector of ["#person", "#marathi", "#hindi"])
      await expect(page.locator(selector)).toHaveCSS("filter", "blur(12px)");
    await expect(page.locator("#ram")).toHaveCSS("filter", "none");
    await expect(page.locator("#price")).toHaveCSS("filter", "none");
    await page.evaluate(() => {
      const row = document.createElement("section");
      row.innerHTML =
        '<div>Profile owner</div><div id="dynamic">NEW_PERSON_CANARY</div>';
      document.body.append(row);
    });
    await expect(page.locator("#dynamic")).toHaveCSS("filter", "blur(12px)");
    await worker.evaluate(
      async (tabId) =>
        chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.__privacyShield!.pick(),
        }),
      tabId,
    );
    await page.locator("#public").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#public")).toHaveCSS("filter", "blur(12px)");
    await worker.evaluate(
      async (tabId) =>
        chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.__privacyShield!.undoManual(),
        }),
      tabId,
    );
    await expect(page.locator("#public")).toHaveCSS("filter", "none");
    await expect(page.locator("#person")).toHaveCSS("filter", "blur(12px)");
    const stored = await worker.evaluate(() =>
      chrome.storage.local.get("semanticMeaningsV1"),
    );
    expect(JSON.stringify(stored)).not.toContain("CANARY");
    expect(JSON.stringify(stored)).not.toContain("Profile owner");
    await worker.evaluate(
      async (tabId) =>
        chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.__privacyShield!.stop(),
        }),
      tabId,
    );
    for (const selector of ["#person", "#uid", "#project", "#dynamic"])
      await expect(page.locator(selector)).toHaveCSS("filter", "none");
    // A new protection session reuses only saved meanings, with no AI request.
    await worker.evaluate(async (tabId) => {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.__privacyShield!.configure({ treatment: "blur" }),
      });
    }, tabId);
    await expect(page.locator("#person")).toHaveCSS("filter", "blur(12px)");
  } finally {
    await page.close();
    await worker.evaluate(() =>
      chrome.storage.local.remove("semanticMeaningsV1"),
    );
  }
});

test("Ask Privately excludes classified values and keeps protection after task edits", async () => {
  const { page, tabId } = await open();
  await worker.evaluate(
    async (tabId) =>
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.__privacyShield!.stop(),
      }),
    tabId,
  );
  const ui = await context.newPage();
  let wire = "";
  await context.route("http://127.0.0.1:4318/classify-elements", (route) => {
    const body = route.request().postDataJSON();
    wire = JSON.stringify(body);
    return route.fulfill({
      json: {
        elements: body.elements.map((e: { id: string }) => ({
          id: e.id,
          category: "PERSON_NAME",
          action: "MASK",
          confidence: 0.97,
        })),
      },
    });
  });
  try {
    await ui.goto(
      `chrome-extension://${extensionId}/index.html?targetTab=${tabId}`,
    );
    await ui.getByLabel("Your question").fill("Summarize");
    await ui.getByRole("button", { name: "Find main content" }).click();
    const preview = ui.getByLabel("AI-safe preview");
    await expect(preview).toHaveValue(/SYNTHETIC_PERSON_CANARY/);
    await ui.getByText("Semantic privacy scan", { exact: true }).click();
    await ui.getByRole("button", { name: "Prepare semantic review" }).click();
    await ui.getByRole("checkbox", { name: "I reviewed these labels" }).check();
    await ui.getByRole("button", { name: "Classify reviewed labels" }).click();
    await ui.getByRole("button", { name: "Apply reviewed protection" }).click();
    await expect(preview).not.toHaveValue(/CANARY/);
    expect(wire).toContain("Profile owner");
    expect(wire).not.toContain("CANARY");
    await ui.getByLabel("Your question").fill("Explain the laptop");
    await expect(preview).not.toHaveValue(/CANARY/);
    await expect(preview).toHaveValue(/Laptop/);
    await expect(
      ui.getByRole("button", { name: "Open Gemini", exact: true }),
    ).toBeDisabled();
    await expect(
      ui.getByText(/External AI received .*reviewed labels/),
    ).toBeVisible();
  } finally {
    await ui.close();
    await page.close();
    await context.unroute("http://127.0.0.1:4318/classify-elements");
  }
});
test("stale and invented semantic IDs cannot alter DOM", async () => {
  const { page, tabId } = await open();
  try {
    const snapshot = await prepare(tabId);
    const apply = (invented: boolean) =>
      worker.evaluate(
        async ({ tabId, snapshot, invented }) =>
          (
            await chrome.scripting.executeScript({
              target: { tabId },
              func: async (
                snapshot: Awaited<ReturnType<typeof prepare>>,
                invented: boolean,
              ) => {
                try {
                  await window.__privacyShield!.semanticApply(
                    snapshot.nonce,
                    {
                      elements: snapshot.elements.map((e) => ({
                        id: invented ? "e999" : e.id,
                        category: "PERSON_NAME",
                        action: "MASK",
                        confidence: 0.99,
                      })),
                    },
                    [],
                    false,
                  );
                  return "applied";
                } catch {
                  return "rejected";
                }
              },
              args: [snapshot, invented],
            })
          )[0].result,
        { tabId, snapshot, invented },
      );
    expect(await apply(true)).toBe("rejected");
    await page.locator("#person").evaluate((el) => {
      el.textContent = "CHANGED_CANARY";
    });
    expect(await apply(false)).toBe("rejected");
    await expect(page.locator("#person")).toHaveCSS("filter", "none");
    await expect(page.locator("#uid")).toHaveCSS("filter", "blur(12px)");
  } finally {
    await page.close();
  }
});
test("consented UI sends reduced labels only; backend failure retains local protection", async () => {
  const { page, tabId } = await open();
  const ui = await context.newPage();
  let wire = "";
  await context.route("http://127.0.0.1:4318/classify-elements", (route) => {
    wire = route.request().postData() ?? "";
    return route.fulfill({ status: 503, json: { error: "offline" } });
  });
  try {
    await ui.goto(
      `chrome-extension://${extensionId}/index.html?targetTab=${tabId}`,
    );
    await ui
      .getByRole("button", { name: "Present safely", exact: true })
      .click();
    await ui.getByText("Semantic privacy scan", { exact: true }).click();
    await ui.getByRole("button", { name: "Prepare semantic review" }).click();
    await expect(
      ui.getByRole("button", { name: "Classify reviewed labels" }),
    ).toBeDisabled();
    await ui.getByRole("checkbox", { name: "I reviewed these labels" }).check();
    await ui.getByRole("button", { name: "Classify reviewed labels" }).click();
    await expect(ui.getByRole("status")).toContainText(
      "Existing local protection remains active",
    );
    expect(wire).toContain("[VALUE_WITHHELD]");
    expect(wire).not.toContain("CANARY");
    await expect(page.locator("#uid")).toHaveCSS("filter", "blur(12px)");
  } finally {
    await ui.close();
    await page.close();
    await context.unroute("http://127.0.0.1:4318/classify-elements");
  }
});
