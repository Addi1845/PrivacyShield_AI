import { describe, expect, it } from "vitest";
import {
  applyAiSubset,
  contextPacket,
  packetIsSafe,
  pasteCapture,
  prepareChoices,
  shoppingSample,
} from "../../packages/context-core";

describe("task-bounded context packets", () => {
  const task = "Compare these two laptops for coding under ₹70,000.";
  it("keeps product facts while excluding identity, delivery, cart and secrets", () => {
    const choices = prepareChoices(pasteCapture(shoppingSample), task);
    const packet = contextPacket(task, choices);
    expect(packet).toContain("16 GB RAM");
    expect(packet).toContain("₹67,000");
    for (const value of [
      "Priya",
      "priya@example.com",
      "Private Road",
      "Your cart",
      "demo_sensitive_token",
    ])
      expect(packet).not.toContain(value);
    expect(choices.filter((b) => b.locked)).toHaveLength(5);
    expect(packetIsSafe(task, choices, packet)).toBe(true);
    expect(packetIsSafe(task, choices, packet + " password: NEW_SECRET")).toBe(
      false,
    );
  });
  it("uses the question to propose relevant blocks without silently discarding user choices", () => {
    const capture = pasteCapture(
      "Battery lasts 10 hours.\nThe delivery courier is a public company.\nThe screen has an OLED panel.",
    );
    const battery = prepareChoices(capture, "Explain battery endurance");
    expect(battery.map((b) => b.included)).toEqual([true, false, false]);
    const screen = prepareChoices(capture, "Explain the OLED screen");
    expect(screen.map((b) => b.included)).toEqual([false, false, true]);
    screen[0].included = true;
    expect(contextPacket("Explain the OLED screen", screen)).toContain(
      "Battery lasts",
    );
  });
  it("sanitizes the task too and rejects restored private content", () => {
    const question = "Email private@example.com: compare RAM";
    const choices = prepareChoices(
      pasteCapture("16 GB RAM on this laptop."),
      question,
    );
    const packet = contextPacket(question, choices);
    expect(packet).not.toContain("private@example.com");
    expect(packetIsSafe(question, choices, packet)).toBe(true);
    expect(
      packetIsSafe(question, choices, packet + " private@example.com"),
    ).toBe(false);
  });
  it("allows AI only to remove existing approved candidates, without rewriting facts", () => {
    const choices = prepareChoices(pasteCapture(shoppingSample), task);
    const next = applyAiSubset(choices, ["b1"]);
    expect(contextPacket(task, next)).toContain("Laptop B: 32 GB RAM");
    expect(contextPacket(task, next)).not.toContain("Laptop A");
    expect(() => applyAiSubset(choices, ["b99"])).toThrow();
    expect(() => applyAiSubset(choices, ["b2"])).toThrow();
    expect(() => applyAiSubset(choices, ["b0", "b0"])).toThrow();
    expect(() => applyAiSubset(choices, [])).toThrow();
  });
  it("does not send an empty task, all excluded blocks or oversize input", () => {
    const choices = prepareChoices(
      pasteCapture("Name: Private Person\nAddress: Private Road"),
      task,
    );
    expect(contextPacket(task, choices)).toBe("");
    expect(packetIsSafe(task, choices, "Task: Compare")).toBe(false);
    expect(() => pasteCapture("x".repeat(30001))).toThrow();
    expect(() => pasteCapture(" ")).toThrow();
  });
  it("preserves the heading that identifies a relevant specification block", () => {
    const choices = prepareChoices(
      {
        source: "main",
        omitted: 0,
        blocks: [
          { id: "b0", text: "Laptop A", section: "s0", heading: true },
          { id: "b1", text: "16 GB RAM, 512 GB SSD, ₹52,000", section: "s0" },
          { id: "b2", text: "Name: Private Person", section: "s0" },
        ],
      },
      "Explain this laptop's RAM",
    );
    expect(choices.map((block) => block.included)).toEqual([true, true, false]);
    expect(contextPacket("Explain RAM", choices)).toContain(
      "Laptop A\n16 GB RAM",
    );
  });
});
