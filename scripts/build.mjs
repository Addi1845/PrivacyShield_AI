import { build } from "esbuild";
import {
  mkdir,
  copyFile,
  writeFile,
  readdir,
  readFile,
} from "node:fs/promises";
const dest = "dist/extension";
await mkdir(dest, { recursive: true });
await build({
  entryPoints: ["apps/extension/src/app.tsx"],
  bundle: true,
  outdir: dest,
  entryNames: "app",
  format: "esm",
  target: "chrome116",
  minify: true,
  legalComments: "eof",
});
await build({
  entryPoints: ["apps/extension/src/background.ts"],
  bundle: true,
  outdir: dest,
  format: "esm",
  target: "chrome116",
  minify: true,
});
await build({
  entryPoints: ["apps/extension/src/content.ts"],
  bundle: true,
  outdir: dest,
  format: "iife",
  target: "chrome116",
  minify: true,
});
await build({
  entryPoints: [
    "apps/extension/src/share-monitor-main.ts",
    "apps/extension/src/share-monitor.ts",
  ],
  bundle: true,
  outdir: dest,
  format: "iife",
  target: "chrome116",
  minify: true,
});
await build({
  entryPoints: ["apps/extension/src/present.ts"],
  bundle: true,
  outdir: dest,
  format: "iife",
  target: "chrome116",
  minify: true,
});
await copyFile("apps/extension/public/present.html", dest + "/present.html");
await copyFile("apps/extension/public/present.css", dest + "/present.css");
await copyFile("apps/extension/manifest.json", dest + "/manifest.json");
await mkdir(dest + "/icons", { recursive: true });
for (const file of await readdir("apps/extension/public/icons"))
  await copyFile(
    "apps/extension/public/icons/" + file,
    dest + "/icons/" + file,
  );
const html =
  '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PrivacyShield AI — Private workspace</title><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>';
await writeFile(dest + "/index.html", html);
await writeFile(dest + "/popup.html", html);
await mkdir(dest + "/ocr", { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  dest + "/ocr/worker.min.js",
);
for (const file of await readdir("node_modules/tesseract.js-core"))
  if (/\.wasm(?:\.js)?$/.test(file))
    await copyFile(
      "node_modules/tesseract.js-core/" + file,
      dest + "/ocr/" + file,
    );
await copyFile(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  dest + "/ocr/eng.traineddata.gz",
);
await mkdir("dist/licenses", { recursive: true });
for (const pkg of [
  "react",
  "react-dom",
  "lucide-react",
  "tldts",
  "tesseract.js",
  "tesseract.js-core",
  "@tesseract.js-data/eng",
]) {
  const files = await readdir("node_modules/" + pkg);
  const name = files.find((f) => /^licen[cs]e/i.test(f));
  if (name)
    await copyFile(
      "node_modules/" + pkg + "/" + name,
      "dist/licenses/" + pkg.replaceAll("/", "_") + ".txt",
    );
}
const manifest = JSON.parse(await readFile(dest + "/manifest.json", "utf8"));
if (manifest.host_permissions)
  throw new Error("Unexpected required host permissions.");
console.log(
  "Built loadable extension at dist/extension, including offline OCR assets.",
);
