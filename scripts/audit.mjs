import { readdir, readFile } from "node:fs/promises";
async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((d) =>
        d.isDirectory() ? walk(dir + "/" + d.name) : dir + "/" + d.name,
      ),
    )
  ).flat();
}
const files = await walk("dist/extension");
for (const f of files) {
  if (/\.(?:js|json|html|css)$/.test(f)) {
    const s = await readFile(f, "utf8");
    if (/gsk_[A-Za-z0-9]{20,}/.test(s)) throw new Error("Credential in bundle");
    if (/sk-(?:or-v1-|proj-)?[A-Za-z0-9_-]{32,}/.test(s))
      throw new Error("Provider credential in bundle");
    if (/<script[^>]+src=["']https?:/i.test(s))
      throw new Error("Remote script in bundle");
  }
  if (/\.env/.test(f)) throw new Error("Environment file in bundle");
}
console.log(
  `Bundle audit passed: ${files.length} files; no recognized provider credentials, environment files, or remote HTML scripts.`,
);
