import { generateKeyPairSync, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const manifest = JSON.parse(
  await readFile("apps/extension/manifest.json", "utf8"),
);
if (!manifest.key) {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  manifest.key = publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64");
  await writeFile(
    "apps/extension/manifest.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
}
const id = createHash("sha256")
  .update(Buffer.from(manifest.key, "base64"))
  .digest("hex")
  .slice(0, 32)
  .split("")
  .map((h) => String.fromCharCode(97 + parseInt(h, 16)))
  .join("");
try {
  let env = await readFile(".env", "utf8");
  env = env.replace(
    /^EXTENSION_ORIGIN=.*$/m,
    `EXTENSION_ORIGIN=chrome-extension://${id}`,
  );
  await writeFile(".env", env);
} catch {
  /* Key is supplied separately. */
}
console.log("Stable extension ID and backend origin configured.");
