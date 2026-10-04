import { describe, it, expect } from "vitest";
import {
  confidencePolicy,
  localDecision,
  mergeDecisions,
  parseDecisions,
  reduceCandidate,
  validateElements,
  type SemanticDecision,
} from "../../packages/semantic-core";
import { semanticOcrCandidates } from "../../apps/extension/src/semantic-ocr";
import { prepareChoices, contextPacket } from "../../packages/context-core";
const decision: SemanticDecision = {
  id: "e0",
  category: "PERSON_NAME",
  action: "MASK",
  confidence: 0.97,
};
const request = {
  consent: true,
  purpose: "prepare this page for screen sharing",
  elements: [{ id: "e0", text: "[VALUE_WITHHELD]", label: "Profile owner" }],
};
describe("semantic privacy boundary", () => {
  it.each([
    { id: "e1" },
    { category: "INVALID" },
    { action: "EXECUTE" },
    { confidence: -1 },
    { confidence: 1.01 },
    { confidence: NaN },
    { selector: "body" },
  ])("rejects invalid model fields %j", (change) => {
    expect(() =>
      parseDecisions({ elements: [{ ...decision, ...change }] }, ["e0"]),
    ).toThrow();
  });
  it("rejects duplicate, missing and unexpected response keys", () => {
    expect(() =>
      parseDecisions({ elements: [decision, decision] }, ["e0", "e1"]),
    ).toThrow();
    expect(() => parseDecisions({ elements: [] }, ["e0"])).toThrow();
    expect(() =>
      parseDecisions({ elements: [decision], script: "bad" }, ["e0"]),
    ).toThrow();
  });
  it("never downgrades local masks and always hides secrets", () => {
    const secret = {
      ...decision,
      category: "AUTH_SECRET" as const,
      action: "ALLOW" as const,
    };
    expect(confidencePolicy(secret).action).toBe("HIDE");
    expect(
      mergeDecisions(
        { ...decision, action: "HIDE" },
        { ...decision, action: "ALLOW" },
      ).action,
    ).toBe("HIDE");
    expect(mergeDecisions(secret, decision).action).toBe("HIDE");
    expect(
      mergeDecisions(decision, { ...decision, action: "REVIEW" }).action,
    ).toBe("MASK");
  });
  it("routes medium and low confidence to review without auto-masking", () => {
    expect(confidencePolicy({ ...decision, confidence: 0.89 }).action).toBe(
      "REVIEW",
    );
    expect(confidencePolicy({ ...decision, confidence: 0.3 }).action).toBe(
      "REVIEW",
    );
    expect(confidencePolicy({ ...decision, confidence: 0.9 }).action).toBe(
      "MASK",
    );
  });
  it("withholds values and recognizes hard local fields before reduction", () => {
    const reduced = reduceCandidate({
      id: "e0",
      text: "SYNTHETIC_PERSON",
      label: "Profile owner",
    });
    expect(reduced).toEqual(request.elements[0]);
    expect(
      reduceCandidate({
        id: "e0",
        text: "Bearer abcdefghijklmnopqrstuvwxyz",
        label: "Profile owner",
      }),
    ).toBeNull();
    expect(
      localDecision({ id: "e0", text: "ABC-82931", label: "Employee UID" })
        .action,
    ).toBe("MASK");
    expect(
      localDecision({ id: "e0", text: "16 GB RAM", label: "RAM" }).action,
    ).toBe("ALLOW");
    expect(
      localDecision({ id: "e0", text: "Project Falcon internal review" })
        .action,
    ).toBe("MASK");
  });
  it("accepts reviewed multilingual labels without sending the value", () => {
    for (const label of ["नाव", "जन्म तारीख", "नाम", "मोबाइल नंबर", "पत्ता"])
      expect(
        reduceCandidate({ id: "e0", text: "PRIVATE_CANARY", label }),
      ).toEqual({ id: "e0", text: "[VALUE_WITHHELD]", label });
  });
  it("validates exact reduced request schemas", () => {
    expect(validateElements(request)).toBe(true);
    expect(
      validateElements({
        ...request,
        elements: [{ ...request.elements[0], label: "gsk_" + "a".repeat(35) }],
      }),
    ).toBe(false);
    for (const invalid of [
      { ...request, consent: false },
      { ...request, url: "https://secret.test" },
      { ...request, elements: [...request.elements, ...request.elements] },
      { ...request, elements: Array(51).fill(request.elements[0]) },
    ])
      expect(validateElements(invalid)).toBe(false);
    for (const text of [
      "private@example.com",
      "password: foo",
      "Aditya Patil",
      "<div>private</div>",
    ])
      expect(
        validateElements({
          ...request,
          elements: [{ ...request.elements[0], text }],
        }),
      ).toBe(false);
    expect(
      validateElements({
        ...request,
        elements: [
          { ...request.elements[0], label: "Email private@example.com" },
        ],
      }),
    ).toBe(false);
  });
  it("keeps semantic context locks across relevance rebuilds", () => {
    const capture = {
      source: "selection" as const,
      omitted: 0,
      blocks: [
        { id: "b0", text: "PRIVATE_CANARY", semanticPrivate: true },
        { id: "b1", text: "Laptop 16 GB RAM" },
      ],
    };
    for (const task of ["Compare laptop", "PRIVATE_CANARY"]) {
      const choices = prepareChoices(capture, task);
      expect(choices[0].locked).toBe(true);
      expect(
        contextPacket(
          task === "PRIVATE_CANARY" ? "Explain laptop" : task,
          choices,
        ),
      ).not.toContain("PRIVATE_CANARY");
    }
  });
  it("OCR sends separate labels only and retains local bounding boxes", () => {
    const lines = [
      { text: "Profile owner", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
      { text: "PRIVATE_CANARY", bbox: { x0: 120, y0: 0, x1: 220, y1: 20 } },
    ];
    const batch = semanticOcrCandidates(lines);
    expect(batch.elements).toEqual(request.elements);
    expect(JSON.stringify(batch.elements)).not.toContain("PRIVATE_CANARY");
    expect(batch.rows.get("e0")).toEqual(lines);
    expect(
      semanticOcrCandidates([
        { ...lines[0], text: "Profile owner: PRIVATE_CANARY" },
      ]).elements,
    ).toEqual([]);
  });
});
