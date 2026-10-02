import { chromium } from "@playwright/test";
/* global document */
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await mkdir("apps/extension/public/icons", { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const data = await page.evaluate((size) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    x.scale(size / 128, size / 128);
    x.fillStyle = "#f2efe8";
    x.beginPath();
    x.roundRect(0, 0, 128, 128, 8);
    x.fill();
    x.translate(64, 64);
    x.rotate(-0.12);
    x.translate(-64, -64);
    x.fillStyle = "#292720";
    x.fillRect(22, 27, 84, 18);
    x.fillRect(22, 83, 70, 18);
    x.fillStyle = "#a13723";
    x.fillRect(22, 55, 59, 18);
    return c.toDataURL("image/png").split(",")[1];
  }, size);
  await writeFile(
    `apps/extension/public/icons/icon${size}.png`,
    Buffer.from(data, "base64"),
  );
}
await browser.close();
