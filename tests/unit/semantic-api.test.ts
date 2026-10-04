import { it, expect } from "vitest";
import { createApi } from "../../apps/api/server.mjs";
const origin = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const body = {
  consent: true,
  purpose: "prepare this page for screen sharing",
  elements: [{ id: "e0", label: "Profile owner", text: "[VALUE_WITHHELD]" }],
};
const decision = {
  id: "e0",
  category: "PERSON_NAME",
  action: "MASK",
  confidence: 0.95,
};
async function withApi(
  options: Parameters<typeof createApi>[0],
  run: (url: string) => Promise<void>,
) {
  const server = createApi({ key: "synthetic-test-key", origin, ...options });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(
      `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/classify-elements`,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
}
const post = (url: string, value: unknown = body, from = origin) =>
  fetch(url, {
    method: "POST",
    headers: { Origin: from, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
it("semantic API enforces origin, schemas, consent and body limits before contacting provider", async () => {
  let calls = 0;
  await withApi(
    {
      providerFetch: async () => {
        calls++;
        throw new Error("should not run");
      },
    },
    async (url) => {
      expect((await post(url, body, "https://evil.example")).status).toBe(403);
      expect((await post(url, { ...body, consent: false })).status).toBe(400);
      expect((await post(url, { ...body, selectors: ["body"] })).status).toBe(
        400,
      );
      expect(
        (
          await post(url, {
            ...body,
            elements: [{ ...body.elements[0], text: "password: unsafe" }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await post(url, {
            ...body,
            elements: [{ ...body.elements[0], label: "x".repeat(70000) }],
          })
        ).status,
      ).toBe(413);
      expect(calls).toBe(0);
    },
  );
});
it.each([
  { id: "e99" },
  { category: "BAD" },
  { action: "SCRIPT" },
  { confidence: 2 },
  { selector: "body" },
])("semantic API rejects invalid provider output %j", async (change) => {
  await withApi(
    {
      providerFetch: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    elements: [{ ...decision, ...change }],
                  }),
                },
              },
            ],
          }),
        ),
    },
    async (url) => {
      expect((await post(url)).status).toBe(503);
    },
  );
});
it.each(["groq", "openrouter"] as const)(
  "%s receives only reduced labels and provider failure is contained",
  async (provider) => {
    let content = "",
      destination = "";
    await withApi(
      {
        provider,
        providerFetch: async (url, options) => {
          destination = url;
          content = String(options.body);
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ elements: [decision] }),
                  },
                },
              ],
            }),
          );
        },
      },
      async (url) => {
        const response = await post(url);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ elements: [decision] });
        expect(destination).toContain(
          provider === "groq" ? "api.groq.com" : "openrouter.ai",
        );
        const wire = JSON.parse(JSON.parse(content).messages[1].content);
        expect(wire).toEqual({
          purpose: body.purpose,
          elements: body.elements,
        });
        expect(content).not.toContain(origin);
      },
    );
  },
);
it("timeout includes a provider that ignores AbortSignal", async () => {
  await withApi(
    { timeoutMs: 20, providerFetch: () => new Promise(() => {}) },
    async (url) => {
      const response = await post(url);
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain(
        "Existing local protection remains active",
      );
    },
  );
});
it("missing key and rate limits preserve the local fallback", async () => {
  await withApi({ key: "" }, async (url) => {
    for (let i = 0; i < 10; i++) expect((await post(url)).status).toBe(503);
    expect((await post(url)).status).toBe(429);
  });
});
