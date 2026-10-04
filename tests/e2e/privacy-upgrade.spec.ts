import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Worker,
} from "@playwright/test";
import { cp, mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
let context: BrowserContext, worker: Worker, id: string;
const form = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Synthetic application</title><style>body{font:20px Arial;margin:30px}td,th{border:1px solid #ccc;padding:12px}table{border-collapse:collapse}img{width:90px;height:100px}nav{margin:20px 0}#public-a,#public-b{padding:15px;border:1px solid #aaa}#crop{font:24px monospace}#outside{margin-left:100px}</style></head><body><nav><a id="nav" href="#">Public navigation example</a></nav><main><h1>Application preview</h1><table><tr><td>Candidate Full Name Entered For CAP Process 2026</td><td id="name">SYNTHETIC_PERSON_CANARY</td></tr><tr><td>Date of Birth (DD/MM/YYYY)</td><td id="dob">2002-03-04</td></tr><tr><td>Application ID</td><td id="application">APP12345</td></tr><tr><td>Religion</td><td id="religion">SYNTHETIC_DEMOGRAPHIC_CANARY</td></tr><tr><td>Annual Family Income(₹)</td><td id="income">100001 - 150000</td></tr><tr><td>API key</td><td id="key">SYNTHETIC_SECRET_CANARY</td></tr><tr><td>Education record</td><td id="education">SYNTHETIC_RECORD_CANARY</td></tr><tr><td>Memory</td><td id="spec">16 GB RAM</td></tr></table><img id="photo" alt="Candidate photograph" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='100'%3E%3Crect width='90' height='100' fill='green'/%3E%3C/svg%3E"><p id="public-a">Public summary A</p><p id="public-b">Public summary B</p><p id="crop"><span id="inside">16 GB RAM</span><span id="outside">OUTSIDE_CANARY</span></p></main></body></html>`;
test.beforeAll(async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), "privacyshield-upgrade-"));
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
    viewport: { width: 1440, height: 1050 },
  });
  [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  id = new URL(worker.url()).hostname;
  await worker.evaluate(() => chrome.storage.local.set({ onboarded: true }));
  await mkdir("docs/screenshots", { recursive: true });
  await context.route("http://127.0.0.1:4317/demo/application-test", (route) =>
    route.fulfill({ contentType: "text/html", body: form }),
  );
});
test.afterAll(async () => context?.close());
async function sourceAndUi() {
  const source = await context.newPage();
  await source.goto("http://127.0.0.1:4317/demo/application-test");
  const tabId = await worker.evaluate(
    async () =>
      (await chrome.tabs.query({})).find(
        (t) => t.active && t.url?.endsWith("/demo/application-test"),
      )!.id!,
  );
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${id}/index.html?targetTab=${tabId}`);
  return { source, ui, tabId };
}
test("table fields, photos, blur/hide and repeated manual selection preserve restoration", async () => {
  const { source, ui, tabId } = await sourceAndUi();
  try {
    await ui
      .getByRole("button", { name: "Present safely", exact: true })
      .click();
    await ui
      .getByRole("switch", {
        name: "Presentation and recording privacy",
        exact: true,
      })
      .click();
    await expect(source.locator("#name")).toHaveCSS("filter", "blur(12px)");
    await expect(source.locator("#dob")).toHaveCSS("filter", "blur(12px)");
    await expect(source.locator("#application")).toHaveCSS(
      "filter",
      "blur(12px)",
    );
    await expect(source.locator("#religion")).toHaveCSS("filter", "blur(12px)");
    await expect(source.locator("#income")).toHaveCSS("filter", "blur(12px)");
    await expect(source.locator("#key")).toHaveCSS("visibility", "hidden");
    await expect(source.locator("#photo")).toHaveCSS("filter", "blur(12px)");
    await expect(source.locator("#spec")).toHaveCSS("filter", "none");
    await expect(
      source.getByText("Candidate Full Name Entered For CAP Process 2026", {
        exact: true,
      }),
    ).toHaveCSS("filter", "none");
    await ui.getByRole("button", { name: "Select an area to hide" }).click();
    await source.bringToFront();
    await source.locator("#public-a").click();
    await source.locator("#public-b").click();
    await expect(source.locator("#public-a")).toHaveCSS("filter", "blur(12px)");
    await expect(source.locator("#public-b")).toHaveCSS("filter", "blur(12px)");
    await source.keyboard.press("Escape");
    await ui.bringToFront();
    await expect(
      ui.getByRole("button", { name: "Undo last area" }),
    ).toBeEnabled();
    await ui.getByRole("button", { name: "Undo last area" }).click();
    await expect(source.locator("#public-b")).toHaveCSS("filter", "none");
    await expect(source.locator("#public-a")).toHaveCSS("filter", "blur(12px)");
    await ui.getByRole("radio", { name: /^Hide/ }).check();
    await expect(source.locator("#name")).toHaveCSS("visibility", "hidden");
    await expect(source.locator("#public-a")).toHaveCSS("visibility", "hidden");
    await expect(source.locator("#name")).toHaveText("SYNTHETIC_PERSON_CANARY");
    await ui.getByRole("radio", { name: /^Blur/ }).check();
    await expect(source.locator("#name")).toHaveCSS("visibility", "visible");
    await expect(source.locator("#name")).toHaveCSS("filter", "blur(12px)");
    // Unknown-field AI results cannot target invented IDs or bypass the snapshot.
    const reviewed = await worker.evaluate(async (tabId) => {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.__privacyShield!.fieldLabels(),
      });
      return r.result!;
    }, tabId);
    expect(JSON.stringify(reviewed)).not.toContain("CANARY");
    const education = reviewed.fields.find(
      (f) => f.label === "Education record",
    )!;
    expect(education).toBeTruthy();
    const invalid = await worker.evaluate(
      async ({ tabId, nonce }) => {
        const [r] = await chrome.scripting.executeScript({
          target: { tabId },
          func: (nonce) => window.__privacyShield!.maskAiFields(nonce, ["f99"]),
          args: [nonce],
        });
        return r.result!;
      },
      { tabId, nonce: reviewed.nonce },
    );
    expect(invalid.error).toBeTruthy();
    await expect(source.locator("#education")).toHaveCSS("filter", "none");
    await worker.evaluate(
      async ({ tabId, nonce, field }) =>
        chrome.scripting.executeScript({
          target: { tabId },
          func: (nonce, field) =>
            window.__privacyShield!.maskAiFields(nonce, [field]),
          args: [nonce, field],
        }),
      { tabId, nonce: reviewed.nonce, field: education.id },
    );
    await expect(source.locator("#education")).toHaveCSS(
      "filter",
      "blur(12px)",
    );
    // Exercise the consented UI boundary: only reviewed labels reach the backend.
    let sentLabels = "";
    await context.route("http://127.0.0.1:4318/classify-fields", (route) => {
      const body = route.request().postDataJSON();
      sentLabels = JSON.stringify(body);
      const field = body.fields.find(
        (field: { label: string }) => field.label === "Education record",
      );
      return route.fulfill({ json: { privateIds: [field.id] } });
    });
    await ui
      .getByText("AI review of this page’s field types", { exact: true })
      .click();
    await ui
      .getByRole("button", { name: "Read field labels for review" })
      .click();
    await expect(
      ui.getByRole("button", { name: "Check field privacy with AI" }),
    ).toBeDisabled();
    await ui
      .getByRole("checkbox", {
        name: "Allow AI to classify these field labels only",
      })
      .check();
    await ui
      .getByRole("button", { name: "Check field privacy with AI" })
      .click();
    await expect(ui.getByRole("status")).toContainText(
      "field types marked private by AI",
    );
    expect(sentLabels).toContain("Education record");
    expect(sentLabels).not.toContain("CANARY");
    expect(sentLabels).not.toContain("2002-03-04");
    expect(
      JSON.parse(sentLabels).fields.every((field: object) =>
        Object.keys(field).every((key) => ["id", "label"].includes(key)),
      ),
    ).toBe(true);
    await context.unroute("http://127.0.0.1:4318/classify-fields");
    await expect(source.locator("#education")).toHaveAttribute(
      "data-privacyshield-ai-private",
      "",
    );
    await source.locator("table").evaluate((table) => {
      const row = (table as HTMLTableElement).insertRow();
      row.insertCell().textContent = "Mother Tongue";
      const value = row.insertCell();
      value.id = "dynamic";
      value.textContent = "SYNTHETIC_LANGUAGE";
    });
    await expect(source.locator("#dynamic")).toHaveCSS("filter", "blur(12px)");
    await expect(source.locator("#education")).toHaveCSS(
      "filter",
      "blur(12px)",
    );
    await expect(source.locator("#education")).toHaveCSS(
      "visibility",
      "visible",
    );
    await source.screenshot({
      path: "docs/screenshots/form-blurred.png",
      fullPage: true,
    });
    await ui.screenshot({
      path: "docs/screenshots/recording-privacy-controls.png",
      fullPage: true,
    });
    await ui
      .getByRole("switch", {
        name: "Presentation and recording privacy",
        exact: true,
      })
      .click();
    for (const target of [
      "#name",
      "#dob",
      "#key",
      "#photo",
      "#public-a",
      "#education",
    ]) {
      await expect(source.locator(target)).toHaveCSS("visibility", "visible");
      await expect(source.locator(target)).toHaveCSS("filter", "none");
    }
  } finally {
    await ui.close();
    await source.close();
  }
});
test("exact element, navigation, highlighted text and rectangular context selections", async () => {
  const { source, ui } = await sourceAndUi();
  try {
    await ui.getByLabel("Your question").fill("Explain the memory");
    const preview = ui.getByLabel("AI-safe preview");
    await ui.getByRole("button", { name: "Pick any element" }).click();
    await expect(
      source.locator("#privacyshield-context-picker"),
    ).toBeAttached();
    await source.locator("#spec").click();
    await expect(preview).toHaveValue(/16 GB RAM/);
    expect(await preview.inputValue()).not.toContain("CANARY");
    await ui.getByRole("button", { name: "Pick any element" }).click();
    await expect(
      source.locator("#privacyshield-context-picker"),
    ).toBeAttached();
    await source.locator("#nav").click();
    await expect(preview).toHaveValue(/Public navigation example/);
    await ui.getByRole("button", { name: "Drag an area" }).click();
    await expect(
      source.locator("#privacyshield-context-picker"),
    ).toBeAttached();
    await source.locator("#inside").scrollIntoViewIfNeeded();
    const box = (await source.locator("#inside").boundingBox())!;
    await source.mouse.move(box.x - 2, box.y - 2);
    await source.mouse.down();
    await source.mouse.move(box.x + box.width + 2, box.y + box.height + 2, {
      steps: 5,
    });
    await source.mouse.up();
    await expect(preview).toHaveValue(/16 GB RAM/);
    expect(await preview.inputValue()).not.toContain("OUTSIDE_CANARY");
    await source.evaluate(() => {
      const text = document.querySelector("#public-a")!.firstChild!;
      const range = document.createRange();
      range.setStart(text, 7);
      range.setEnd(text, 14);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await ui.getByRole("button", { name: "Use highlighted text" }).click();
    await expect(preview).toHaveValue(/summary/);
    expect(await preview.inputValue()).not.toContain("Public summary A");
    await ui.getByRole("button", { name: "Scan this page" }).click();
    await expect(preview).toHaveValue(/16 GB RAM/);
    for (const value of [
      "SYNTHETIC_PERSON",
      "2002-03-04",
      "APP12345",
      "SYNTHETIC_DEMOGRAPHIC",
      "100001 - 150000",
      "SYNTHETIC_SECRET",
    ])
      expect(await preview.inputValue()).not.toContain(value);
  } finally {
    await ui.close();
    await source.close();
  }
});
test("browser capture preflight cancels, keeps fresh activation, tracks recording and disables cleanly", async () => {
  const source = await context.newPage();
  await source.goto("http://127.0.0.1:4317/demo/application-test");
  const tabId = await worker.evaluate(
    async () =>
      (await chrome.tabs.query({})).find(
        (t) => t.active && t.url?.endsWith("/demo/application-test"),
      )!.id!,
  );
  try {
    await source.evaluate(() => {
      const state = window as unknown as Record<string, unknown>;
      state.calls = 0;
      state.activation = false;
      state.promptPresent = true;
      state.captureError = "";
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const stream = canvas.captureStream(10);
      state.testStream = stream;
      state.testCanvas = canvas;
      const fake = () => {
        state.calls = Number(state.calls) + 1;
        state.activation = navigator.userActivation.isActive;
        state.promptPresent = !!document.querySelector(
          "#privacyshield-share-preflight",
        );
        return Promise.resolve(stream);
      };
      state.originalCapture = fake;
      Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
        value: fake,
        configurable: true,
        writable: true,
      });
      const button = document.createElement("button");
      button.id = "share";
      button.textContent = "Start browser sharing";
      button.onclick = () => {
        navigator.mediaDevices
          .getDisplayMedia({ video: true })
          .then(() => (state.captureError = "started"))
          .catch((error) => (state.captureError = error.name));
      };
      document.body.prepend(button);
    });
    await worker.evaluate(async (tabId) => {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["share-monitor.js"],
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["share-monitor-main.js"],
        world: "MAIN",
      });
    }, tabId);
    await source.locator("#share").click();
    await expect(
      source.getByRole("dialog", {
        name: "Privacy before sharing or recording",
      }),
    ).toBeVisible();
    expect(
      await source.evaluate(
        () => (window as unknown as Record<string, unknown>).calls,
      ),
    ).toBe(0);
    await source
      .getByRole("button", { name: "Cancel sharing", exact: true })
      .click();
    await expect
      .poll(() =>
        source.evaluate(
          () => (window as unknown as Record<string, unknown>).captureError,
        ),
      )
      .toBe("NotAllowedError");
    await source.locator("#share").click();
    await source
      .getByRole("checkbox", {
        name: "I inspected the protected tab I will share.",
      })
      .check();
    await source.screenshot({ path: "docs/screenshots/capture-preflight.png" });
    await source
      .getByRole("button", { name: "Continue with prepared tab", exact: true })
      .click();
    await expect
      .poll(() =>
        source.evaluate(
          () => (window as unknown as Record<string, unknown>).calls,
        ),
      )
      .toBe(1);
    expect(
      await source.evaluate(
        () => (window as unknown as Record<string, unknown>).activation,
      ),
    ).toBe(true);
    expect(
      await source.evaluate(
        () => (window as unknown as Record<string, unknown>).promptPresent,
      ),
    ).toBe(false);
    await expect
      .poll(() =>
        worker.evaluate(
          (tabId) => chrome.action.getBadgeText({ tabId }),
          tabId,
        ),
      )
      .toBe("LIVE");
    await source.evaluate(() => {
      const state = window as unknown as Record<string, unknown>;
      const recorder = new MediaRecorder(state.testStream as MediaStream);
      state.recorder = recorder;
      recorder.start();
      (state.testCanvas as HTMLCanvasElement)
        .getContext("2d")!
        .fillRect(0, 0, 100, 100);
    });
    await expect
      .poll(() =>
        worker.evaluate(
          (tabId) => chrome.action.getBadgeText({ tabId }),
          tabId,
        ),
      )
      .toBe("REC");
    await source.evaluate(() =>
      (
        (window as unknown as Record<string, unknown>).recorder as MediaRecorder
      ).stop(),
    );
    await expect
      .poll(() =>
        worker.evaluate(
          (tabId) => chrome.action.getBadgeText({ tabId }),
          tabId,
        ),
      )
      .toBe("LIVE");
    await source.evaluate(() =>
      ((window as unknown as Record<string, unknown>).testStream as MediaStream)
        .getTracks()
        .forEach((track) => track.stop()),
    );
    await expect
      .poll(() =>
        worker.evaluate(
          (tabId) => chrome.action.getBadgeText({ tabId }),
          tabId,
        ),
      )
      .toBe("");
    await worker.evaluate(async (tabId) => {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () =>
          document.dispatchEvent(new Event("privacyshield-monitor-disable")),
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () =>
          document.dispatchEvent(new Event("privacyshield-monitor-disable")),
      });
    }, tabId);
    expect(
      await source.evaluate(
        () =>
          navigator.mediaDevices.getDisplayMedia ===
          (window as unknown as Record<string, unknown>).originalCapture,
      ),
    ).toBe(true);
    await source.locator("#share").click();
    await expect
      .poll(() =>
        source.evaluate(
          () => (window as unknown as Record<string, unknown>).calls,
        ),
      )
      .toBe(2);
    await expect(source.getByRole("dialog")).toHaveCount(0);
  } finally {
    await source.close();
  }
});

test("site-scoped reminders register, survive reload and disable in every open site tab", async () => {
  const { source, ui } = await sourceAndUi();
  const other = await context.newPage();
  await other.goto("http://127.0.0.1:4317/demo/application-test");
  try {
    await ui
      .getByRole("button", { name: "Present safely", exact: true })
      .click();
    const toggle = ui.getByRole("switch", {
      name: "Automatic sharing reminders",
      exact: true,
    });
    await toggle.click();
    await expect(toggle).toBeChecked();
    expect(
      await worker.evaluate(
        async () =>
          (await chrome.scripting.getRegisteredContentScripts()).length,
      ),
    ).toBe(2);
    await source.reload();
    await other.reload();
    for (const p of [source, other])
      expect(
        await p.evaluate(() =>
          Object.hasOwn(navigator.mediaDevices, "__privacyShieldMonitor"),
        ),
      ).toBe(true);
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    expect(
      await worker.evaluate(
        async () =>
          (await chrome.scripting.getRegisteredContentScripts()).length,
      ),
    ).toBe(0);
    for (const p of [source, other])
      expect(
        await p.evaluate(() =>
          Object.hasOwn(navigator.mediaDevices, "__privacyShieldMonitor"),
        ),
      ).toBe(false);
  } finally {
    await ui.close();
    await source.close();
    await other.close();
  }
});
test("local form OCR covers separated personal values and offers opaque or blurred pixels", async () => {
  const ui = await context.newPage();
  try {
    await ui.goto("chrome-extension://" + id + "/index.html?tool=image");
    await ui.getByRole("button", { name: "Screenshot", exact: true }).click();
    const fixture = await ui.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1100;
      c.height = 360;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "black";
      ctx.font = "28px Arial";
      ctx.fillText("Candidate Full Name", 30, 80);
      ctx.fillText("Synthetic Person", 550, 80);
      ctx.fillText("Date of Birth", 30, 150);
      ctx.fillText("2002-03-04", 550, 150);
      ctx.fillText("Laptop price: 52000 INR", 30, 240);
      return c.toDataURL().split(",")[1];
    });
    await ui.getByLabel("Import screenshot").setInputFiles({
      name: "synthetic-form.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    });
    const requests: string[] = [];
    ui.on("request", (r) => {
      if (r.url().startsWith("http")) requests.push(r.url());
    });
    await ui.getByRole("button", { name: "Scan with local OCR" }).click();
    await expect(ui.getByRole("status")).toContainText(
      "sensitive lines suggested",
      { timeout: 90000 },
    );
    expect(requests).toEqual([]);
    const pixel = () =>
      ui.evaluate(() =>
        Array.from(
          document
            .querySelector("canvas")!
            .getContext("2d")!
            .getImageData(560, 140, 1, 1).data,
        ),
      );
    expect(await pixel()).toEqual([16, 20, 18, 255]);
    await ui.getByLabel("Screenshot treatment").selectOption("blur");
    await expect.poll(pixel).not.toEqual([16, 20, 18, 255]);
    await ui.getByLabel("Screenshot treatment").selectOption("hide");
    await expect.poll(pixel).toEqual([16, 20, 18, 255]);
    await ui.screenshot({
      path: "docs/screenshots/form-ocr-review.png",
      fullPage: true,
    });
  } finally {
    await ui.close();
  }
});

test("local OCR reads ruled application-form cells without covering the public title", async () => {
  const ui = await context.newPage();
  try {
    await ui.goto(`chrome-extension://${id}/index.html?tool=image`);
    await ui.getByRole("button", { name: "Screenshot", exact: true }).click();
    const fixture = await ui.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 390;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#252525";
      ctx.lineWidth = 1;
      for (const y of [45, 110, 160, 225, 290, 355]) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(1180, y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(640, 160);
      ctx.lineTo(640, 355);
      ctx.stroke();
      ctx.fillStyle = "black";
      ctx.font = "bold 24px Arial";
      ctx.fillText("PUBLIC ADMISSION INFORMATION", 40, 32);
      ctx.font = "22px Arial";
      ctx.fillText("Application ID: TEST123456", 40, 83);
      ctx.fillText("Candidate Full Name", 40, 196);
      ctx.fillText("SYNTHETIC PERSON", 665, 196);
      ctx.fillText("Date of Birth", 40, 258);
      ctx.fillText("2001-04-05", 665, 258);
      ctx.fillText("Laptop specification", 40, 325);
      ctx.fillText("16 GB RAM", 665, 325);
      return c.toDataURL().split(",")[1];
    });
    await ui.getByLabel("Import screenshot").setInputFiles({
      name: "synthetic-ruled-form.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    });
    const requests: string[] = [];
    ui.on("request", (request) => {
      if (request.url().startsWith("http")) requests.push(request.url());
    });
    await ui.getByRole("button", { name: "Scan with local OCR" }).click();
    await expect(ui.getByRole("status")).toContainText(
      "sensitive lines suggested",
      { timeout: 90000 },
    );
    const covered = await ui.evaluate(() => {
      const ctx = document.querySelector("canvas")!.getContext("2d")!;
      const isCovered = (x: number, y: number) => {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        return pixel[0] === 16 && pixel[1] === 20 && pixel[2] === 18;
      };
      return {
        applicationId: isCovered(160, 74),
        name: isCovered(720, 187),
        birthDate: isCovered(715, 249),
        publicTitle: isCovered(160, 22),
        publicSpec: isCovered(720, 315),
      };
    });
    expect(covered).toEqual({
      applicationId: true,
      name: true,
      birthDate: true,
      publicTitle: false,
      publicSpec: false,
    });
    expect(requests).toEqual([]);
  } finally {
    await ui.close();
  }
});
