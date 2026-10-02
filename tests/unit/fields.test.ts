import { it, expect } from "vitest";
import { classifyField, sensitiveOcrLines } from "../../packages/field-core";
import { sanitize, detect } from "../../packages/privacy-core";
import { prepareChoices } from "../../packages/context-core";

it("classifies separate admissions-form labels without depending on value formats", () => {
  for (const label of [
    "Candidate Full Name Entered For CAP Process 2026",
    "Name as Adhar",
    "DOB as Adhar",
    "Application ID",
    "APAAR ID",
    "Masked Adhar",
    "Annual Family Income(₹)",
    "Religion",
    "Candidate Category",
    "Mother Tongue",
    "PWD Type",
    "Signature",
  ])
    expect(classifyField(label), label).not.toBeNull();
  expect(classifyField("Laptop price")).toBeNull();
  expect(classifyField("16 GB RAM")).toBeNull();
});
it("excludes standalone form values from AI context using their associated labels", () => {
  const choices = prepareChoices(
    {
      source: "element",
      omitted: 0,
      blocks: [
        {
          id: "b0",
          text: "SYNTHETIC_PERSON",
          fieldLabel: "Candidate Full Name",
        },
        { id: "b1", text: "2002-03-04", fieldLabel: "Date of Birth" },
        { id: "b2", text: "16 GB RAM", fieldLabel: "Memory" },
      ],
    },
    "Explain this application",
  );
  expect(choices[0].locked).toBe(true);
  expect(choices[1].included).toBe(false);
  expect(choices[2].locked).toBe(false);
});
it("sanitizes labelled names, dates, demographics and identifiers in pasted text", () => {
  const raw =
    "Candidate Full Name Entered For CAP Process 2026: Synthetic Person\nDate of Birth: 2002-03-04\nApplication ID: ABC123456\nReligion: Synthetic faith\nAnnual Family Income: 100001 - 150000\nLaptop price: ₹52,000";
  const result = sanitize(raw, true).sanitizedText;
  for (const value of [
    "Synthetic Person",
    "2002-03-04",
    "ABC123456",
    "Synthetic faith",
    "100001 - 150000",
  ])
    expect(result).not.toContain(value);
  expect(result).toContain("₹52,000");
});
it("OCR protects separate value blocks on a sensitive label row and keeps public rows", () => {
  const lines = [
    { text: "Date of Birth", bbox: { x0: 10, y0: 10, x1: 150, y1: 30 } },
    { text: "2002-03-04", bbox: { x0: 450, y0: 12, x1: 600, y1: 32 } },
    { text: "Price ₹52,000", bbox: { x0: 10, y0: 70, x1: 300, y1: 90 } },
  ];
  const result = sensitiveOcrLines(lines, (text) => detect(text).length > 0);
  expect(result.map((line) => line.text)).toEqual([
    "Date of Birth",
    "2002-03-04",
  ]);
});
