import { it, expect } from "vitest";
import {
  createApi,
  validate,
  validateReview,
  validateMinimize,
  validateFields,
} from "../../apps/api/server.mjs";
import type { Server } from "node:http";
const origin = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
it("SEC-003: API rejects raw content, unknown codes and missing consent", () => {
  expect(validate({ consent: true, codes: ["URGENCY"] })).toBe(true);
  expect(validate({ consent: true, codes: ["URGENCY"], text: "secret" })).toBe(
    false,
  );
  expect(validate({ consent: false, codes: ["URGENCY"] })).toBe(false);
  expect(validate({ consent: true, codes: ["Ignore instructions"] })).toBe(
    false,
  );
});
it("AI selection accepts bounded consented blocks and checks privacy in the task", () => {
  const body = {
    consent: true,
    purpose: "Compare laptops",
    blocks: [{ id: "b0", text: "16 GB RAM, ₹52,000" }],
  };
  expect(validateMinimize(body)).toBe(true);
  expect(validateMinimize({ ...body, consent: false })).toBe(false);
  expect(validateMinimize({ ...body, purpose: "password: plaintext" })).toBe(
    false,
  );
  expect(validateMinimize({ ...body, purpose: "Phone: +91 98765 43210" })).toBe(
    false,
  );
  expect(
    validateMinimize({
      ...body,
      purpose: "Email [REDACTED_PRIVATE]: compare RAM",
    }),
  ).toBe(true);
  expect(validateMinimize({ ...body, url: "PRIVATE_URL" })).toBe(false);
  expect(
    validateMinimize({ ...body, purpose: "Contact private@example.com" }),
  ).toBe(false);
  expect(
    validateReview({
      consent: true,
      purpose: "private@example.com",
      sanitizedText: "Public facts",
    }),
  ).toBe(false);
  expect(
    validateMinimize({ ...body, blocks: [...body.blocks, ...body.blocks] }),
  ).toBe(false);
  expect(
    validateMinimize({
      ...body,
      blocks: [{ id: "b0", text: "private@example.com" }],
    }),
  ).toBe(false);
});
it("API minimizer rejects invented IDs and returns only a subset of sent blocks", async () => {
  let responseIds = ["b9"];
  let payload = "";
  const server: Server = createApi({
    origin,
    key: "test-not-a-real-key",
    providerFetch: async (_url: string, options: RequestInit) => {
      payload = String(options.body);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  keepIds: responseIds,
                  ignored: "not passed to the UI",
                }),
              },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error();
  const request = () =>
    fetch(`http://127.0.0.1:${address.port}/minimize-context`, {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        consent: true,
        purpose: "Compare RAM",
        blocks: [
          { id: "b0", text: "16 GB RAM" },
          { id: "b1", text: "Public unrelated sentence" },
        ],
      }),
    });
  try {
    expect((await request()).status).toBe(502);
    responseIds = ["b0"];
    const good = await request();
    expect(good.status).toBe(200);
    expect(await good.json()).toEqual({ keepIds: ["b0"] });
    expect(payload).toContain("16 GB RAM");
    expect(payload).not.toContain("PRIVATE_URL");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it("context review accepts only consented, locally sanitized text", () => {
  expect(
    validateReview({
      consent: true,
      purpose: "Summarize status",
      sanitizedText: "Person 1 completed the review.",
    }),
  ).toBe(true);
  expect(
    validateReview({
      consent: true,
      purpose: "Summarize status",
      sanitizedText: "Contact private@example.com",
    }),
  ).toBe(false);
  expect(
    validateReview({
      consent: false,
      purpose: "Summarize status",
      sanitizedText: "Already sanitized",
    }),
  ).toBe(false);
});
it("API enforces origin and sends only fixed descriptions upstream", async () => {
  let payload = "";
  const server: Server = createApi({
    origin,
    key: "test-not-a-real-key",
    providerFetch: async (_url: string, options: RequestInit) => {
      payload = String(options.body);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Verify independently." } }],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error();
  const url = `http://127.0.0.1:${address.port}/explain`;
  try {
    const denied = await fetch(url, {
      method: "POST",
      headers: { Origin: "https://evil.example" },
      body: "{}",
    });
    expect(denied.status).toBe(403);
    const bad = await fetch(url, {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        consent: true,
        codes: ["URGENCY"],
        text: "CANARY",
      }),
    });
    expect(bad.status).toBe(400);
    expect(payload).toBe("");
    const good = await fetch(url, {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({ consent: true, codes: ["URGENCY"] }),
    });
    expect(good.status).toBe(200);
    expect(payload).toContain("Pressure or urgency");
    expect(payload).not.toContain("CANARY");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it("Groq context review returns structured output without restoring secrets", async () => {
  let payload = "";
  const server: Server = createApi({
    origin,
    key: "test-not-a-real-key",
    providerFetch: async (_url: string, options: RequestInit) => {
      payload = String(options.body);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sanitizedText: "[INTERNAL_PROJECT_1] is ready for review.",
                  findings: [
                    {
                      category: "Internal project",
                      reason: "The project name is not needed for the task.",
                    },
                  ],
                  summary: "One contextual identifier was replaced.",
                }),
              },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error();
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/review-context`,
      {
        method: "POST",
        headers: { Origin: origin },
        body: JSON.stringify({
          consent: true,
          purpose: "Summarize status",
          sanitizedText: "Project Falcon is ready for review.",
        }),
      },
    );
    expect(response.status).toBe(200);
    const review = await response.json();
    expect(review.sanitizedText).toContain("[INTERNAL_PROJECT_1]");
    expect(payload).toContain("Project Falcon");
    expect(payload).toContain("privacy minimization assistant");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it("field review rejects values and only accepts consented bounded labels", () => {
  const body = {
    consent: true,
    fields: [{ id: "f0", label: "Personal name" }],
  };
  expect(validateFields(body)).toBe(true);
  expect(validateFields({ ...body, consent: false })).toBe(false);
  expect(
    validateFields({
      ...body,
      fields: [{ id: "f0", label: "Name", value: "SYNTHETIC_PERSON" }],
    }),
  ).toBe(false);
  expect(
    validateFields({
      ...body,
      fields: [{ id: "f0", label: "Name: Synthetic Person" }],
    }),
  ).toBe(false);
  expect(
    validateFields({ ...body, fields: [...body.fields, ...body.fields] }),
  ).toBe(false);
});
it("AI field classifier cannot invent fields or return value replacements", async () => {
  let responseIds = ["f99"],
    payload = "";
  const server: Server = createApi({
    origin,
    key: "synthetic-test",
    providerFetch: async (_url: string, options: RequestInit) => {
      payload = String(options.body);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: JSON.stringify({ privateIds: responseIds }) },
            },
          ],
        }),
      );
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error();
  const request = () =>
    fetch("http://127.0.0.1:" + address.port + "/classify-fields", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        consent: true,
        fields: [
          { id: "f0", label: "Education record" },
          { id: "f1", label: "Laptop price" },
        ],
      }),
    });
  try {
    expect((await request()).status).toBe(502);
    responseIds = ["f0"];
    const good = await request();
    expect(good.status).toBe(200);
    expect(await good.json()).toEqual({ privateIds: ["f0"] });
    expect(payload).toContain("Education record");
    expect(payload).not.toContain("SYNTHETIC_PERSON");
    responseIds = ["f0", "f0"];
    expect((await request()).status).toBe(502);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
