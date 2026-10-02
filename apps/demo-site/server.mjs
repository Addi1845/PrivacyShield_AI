import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist/extension");
const demo =
  '<!doctype html><html lang="en"><meta charset="utf-8"><title>PrivacyShield synthetic demo</title><style>body{font:18px system-ui;background:#f4f6ef;color:#24392c;max-width:1000px;margin:60px auto}section{background:white;border:1px solid #dce3d4;border-radius:12px;padding:30px;margin:20px 0}h1{font-size:40px}button,textarea{padding:12px;font:inherit}textarea{width:90%;height:120px}.tag{color:#5b6d42;font-size:13px}</style><p class="tag">PRIVACYSHIELD / SYNTHETIC FIXTURES ONLY</p><h1>Customer operations</h1><section id="customer"><h2>Customer Aditya</h2><p>Contact: aditya@example.com</p><p>Order CUST-78291 · 2 units · ₹2,500</p><p>Authorization: Bearer demo_sensitive_token_1234567890</p><p id="dynamic"></p><button id="insert">Insert new customer email</button></section><section><h2>Demo AI receiver</h2><p>Paste only the reviewed sanitized copy. This local receiver is a test fixture, not an AI model.</p><textarea aria-label="Demo receiver input" id="prompt"></textarea><button id="send">Send to local demo</button><pre id="received"></pre></section><section><h2>Unsupported surfaces</h2><p>Canvas, images, frames, editable fields and desktop apps need separate review.</p><canvas width="200" height="30"></canvas><iframe title="Unsupported frame" srcdoc="Frame is not masked"></iframe></section><script>document.querySelector("#insert").onclick=()=>document.querySelector("#dynamic").textContent="New contact: fresh@example.com";document.querySelector("#send").onclick=async()=>{const r=await fetch("/receive",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sanitizedText:document.querySelector("#prompt").value})});document.querySelector("#received").textContent=JSON.stringify(await r.json(),null,2);};</script></html>';
http
  .createServer(async (req, res) => {
    if (req.url === "/receive" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 150000) {
          res.writeHead(413).end();
          return;
        }
      }
      try {
        const data = JSON.parse(body);
        if (
          typeof data.sanitizedText !== "string" ||
          Object.keys(data).length !== 1
        )
          throw Error();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ received: data.sanitizedText, demo: true }));
      } catch {
        res.writeHead(400).end();
      }
      return;
    }
    if (req.url?.startsWith("/demo")) {
      res.setHeader("Content-Type", "text/html");
      res.end(demo);
      return;
    }
    try {
      const path = resolve(
        root,
        "." +
          decodeURIComponent(
            new URL(req.url, "http://localhost").pathname === "/"
              ? "/index.html"
              : new URL(req.url, "http://localhost").pathname,
          ),
      );
      if (!path.startsWith(root + sep) && path !== root) {
        res.writeHead(403).end();
        return;
      }
      const file = path === root ? resolve(root, "index.html") : path;
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".wasm": "application/wasm",
          ".gz": "application/gzip",
        }[extname(file)] ?? "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(4317, "127.0.0.1", () =>
    console.log(
      "Dashboard preview http://127.0.0.1:4317 — synthetic demo /demo/presentation",
    ),
  );
