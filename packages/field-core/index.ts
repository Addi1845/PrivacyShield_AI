export type FieldCategory =
  | "NAME"
  | "BIRTH"
  | "IDENTIFIER"
  | "DEMOGRAPHIC"
  | "FINANCIAL"
  | "ADDRESS"
  | "CONTACT"
  | "SECRET"
  | "IMAGE";
export const fieldLabels: {
  category: FieldCategory;
  pattern: RegExp;
  description: string;
}[] = [
  {
    category: "SECRET",
    pattern:
      /\b(?:password|passwd|api[ _-]?key|access[ _-]?token|authorization|secret|private key|private field|confidential|sensitive field)\b/i,
    description: "Credential or explicitly private field",
  },
  {
    category: "NAME",
    pattern:
      /\b(?:(?:candidate|applicant|employee|patient|customer|student|father|mother|guardian)(?:'s)?\s+(?:full\s+)?name|full\s+name|name\s+(?:as|on)\s+(?:aadha?r|adha?r|passport)|name\s+entered)\b|^name\s*[:=]?$/i,
    description: "Personal name",
  },
  {
    category: "BIRTH",
    pattern: /\b(?:date\s+of\s+birth|birth\s+date|d\.?o\.?b\.?)\b/i,
    description: "Date of birth",
  },
  {
    category: "IDENTIFIER",
    pattern:
      /\b(?:application\s*(?:id|number|no)|apaar\s*(?:id|number|no)?|aadha?r|adha?r|social security|ssn|passport\s*(?:id|number|no)|pan\s*(?:number|no|card)|(?:candidate|student|employee|patient|customer|account|registration|roll)\s*(?:uid|id|number|no))\b/i,
    description: "Personal identifier",
  },
  {
    category: "DEMOGRAPHIC",
    pattern:
      /\b(?:gender|sex|religion|caste|candidate\s+category|nationality|mother\s+tongue|marital\s+status|religious\s+minority|linguistic\s+minority|orphan|disability|pwd\s+type|ethnicity)\b/i,
    description: "Personal demographic field",
  },
  {
    category: "FINANCIAL",
    pattern:
      /\b(?:(?:annual\s+)?(?:family|household|personal)\s+income|salary|bank\s+account|card\s+number|credit\s+card|ifsc)\b/i,
    description: "Personal financial field",
  },
  {
    category: "ADDRESS",
    pattern:
      /\b(?:(?:home|residential|mailing|permanent|correspondence|delivery|shipping|billing)\s+address|address|pin\s*code|zip\s*code)\b/i,
    description: "Address",
  },
  {
    category: "CONTACT",
    pattern: /\b(?:e-?mail|phone|mobile|contact\s+(?:number|no))\b/i,
    description: "Contact details",
  },
  {
    category: "IMAGE",
    pattern:
      /\b(?:candidate\s+photo|photograph|profile\s+(?:photo|picture)|signature)\b/i,
    description: "Photo or signature",
  },
];
export function classifyField(label: string) {
  if (label.length > 350) return null;
  const normalized = label.replace(/[|_:]/g, " ").replace(/\s+/g, " ").trim();
  return fieldLabels.find((rule) => rule.pattern.test(normalized)) ?? null;
}

// Shared pure row geometry for local OCR; labels and values can be recognized as
// different lines/blocks, so line-only regexes are insufficient.
export type OcrLine = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};
export function sensitiveOcrLines(
  lines: OcrLine[],
  detected: (text: string) => boolean,
  categories?: FieldCategory[],
) {
  const labels = lines.filter((line) => {
    const field = classifyField(line.text);
    return field && (!categories || categories.includes(field.category));
  });
  return lines.filter(
    (line) =>
      detected(line.text) ||
      labels.some((label) => {
        const a = label.bbox,
          b = line.bbox;
        const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        return overlap >= Math.min(a.y1 - a.y0, b.y1 - b.y0) * 0.4;
      }),
  );
}
