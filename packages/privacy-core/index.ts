export type Kind =
  | "EMAIL"
  | "PHONE"
  | "PERSON_NAME"
  | "CUSTOMER_ID"
  | "ACCOUNT_ID"
  | "SECRET"
  | "UNKNOWN"
  | "MANUAL";
export interface Detection {
  id: string;
  kind: Kind;
  start: number;
  end: number;
  reason: string;
  replacement?: string;
}
export interface Result {
  sanitizedText: string;
  detections: Detection[];
  status: "READY_FOR_REVIEW" | "REVIEW_REQUIRED";
}
const rules: { kind: Kind; re: RegExp; group?: number; reason: string }[] = [
  {
    kind: "PERSON_NAME",
    re: /(?:^|[\r\n;|])[ \t]*(?:name|first[ \t]+name|last[ \t]+name|given[ \t]+name|surname|display[ \t]+name|account[ \t]+holder)[ \t]*[:=：][ \t]*(?:\r?\n[ \t]*)?([^\r\n,;|]+)/gimu,
    group: 1,
    reason: "Explicit personal-name field",
  },
  {
    kind: "PERSON_NAME",
    re: /\b(?:(?:candidate|applicant|father|mother|guardian|employee)(?:'s)?\s+(?:full\s+)?name(?:\s+entered[^:\n\t]{0,60})?|full\s+name|name\s+(?:as|on)\s+(?:aadha?r|adha?r|passport))\s*[:=\t]\s*([^\n;|]+)/gi,
    group: 1,
    reason: "Labelled personal name",
  },
  {
    kind: "ACCOUNT_ID",
    re: /\b(?:application\s*(?:id|number|no)|apaar\s*(?:id|number|no)?|(?:masked\s+)?(?:aadha?r|adha?r)|passport\s*(?:number|no)|registration\s*(?:id|number|no))\s*[:=\t]\s*([\w -]+)/gi,
    group: 1,
    reason: "Government, application or personal identifier",
  },
  {
    kind: "UNKNOWN",
    re: /\b(?:date\s+of\s+birth(?:\s*\([^)]*\))?|dob(?:\s+as\s+(?:aadha?r|adha?r))?|gender|religion|nationality|caste|candidate\s+category|mother\s+tongue|(?:annual\s+)?family\s+income(?:\s*\([^)]*\))?|religious\s+minority|linguistic\s+minority|orphan|pwd\s+type)\s*[:=\t]\s*([^\n;|]+)/gi,
    group: 1,
    reason: "Personal form field",
  },
  {
    kind: "SECRET",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    reason: "Private key block",
  },
  {
    kind: "SECRET",
    re: /\bBearer\s+[^\s,;]+/gi,
    reason: "Authorization credential",
  },
  {
    kind: "SECRET",
    re: /\b(?:sk-(?:proj-)?[\w-]{12,}|gsk_[\w]{20,}|gh[pousr]_[\w]{16,}|github_pat_[\w]{16,}|AKIA[A-Z0-9]{16}|xox[baprs]-[\w-]{10,}|demo_sensitive_token_[\w]+)/g,
    reason: "Credential pattern",
  },
  {
    kind: "SECRET",
    re: /\b(?:api[_ -]?key|password|passwd|secret|access[_ -]?token|token)\s*[:=]\s*["']?([^\s"',;]+)/gi,
    group: 1,
    reason: "Sensitive credential label",
  },
  {
    kind: "SECRET",
    re: /https?:\/\/([^\s/@]+:[^\s/@]+)@/gi,
    group: 1,
    reason: "Credentials embedded in URL",
  },
  {
    kind: "SECRET",
    re: /[?&](?:token|key|api_key|access_token|password|secret)=([^&#\s]+)/gi,
    group: 1,
    reason: "Credential in URL query",
  },
  {
    kind: "EMAIL",
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    reason: "Email address",
  },
  {
    kind: "PHONE",
    re: /(?<![\w\d])(?:\+91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?![\w\d])/g,
    reason: "Indian mobile number pattern",
  },
  {
    kind: "PHONE",
    re: /(?<!\w)\+\d{1,3}[ .-](?:\(?\d{2,4}\)?[ .-]){1,3}\d{3,4}(?!\w)/g,
    reason: "International phone pattern",
  },
  {
    kind: "CUSTOMER_ID",
    re: /\bCUST[-_]\d+\b/gi,
    reason: "Customer identifier",
  },
  {
    kind: "ACCOUNT_ID",
    re: /\b(?:account|a\/c|customer id|patient id)\s*[:#=]\s*([\w-]+)/gi,
    group: 1,
    reason: "Labelled private identifier",
  },
  {
    kind: "PERSON_NAME",
    re: /\b(?:Customer|Patient|Name:)\s+([\p{L}][\p{L}'’-]*(?:[ \t]+[\p{Lu}][\p{L}'’-]*)?)/gu,
    group: 1,
    reason: "Name inferred from label; review context",
  },
  {
    kind: "UNKNOWN",
    re: /\b(?:confidential|private|sensitive|address|medical|ssn|aadhaar|pan)\s*[:=]\s*([^\n;]+)/gi,
    group: 1,
    reason: "Potentially sensitive field; manual review required",
  },
];
export function detect(text: string): Detection[] {
  if (typeof text !== "string" || text.length > 100_000)
    throw new Error("Use up to 100,000 characters per scan.");
  const found: Detection[] = [];
  for (const rule of rules) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    for (const m of text.matchAll(re)) {
      const value = m[rule.group ?? 0];
      if (!value || /^\[(?:REDACTED|PHONE|PRIVATE)/.test(value)) continue;
      const start = m.index! + (rule.group ? m[0].lastIndexOf(value) : 0);
      found.push({
        id: `${start}:${start + value.length}:${rule.kind}`,
        kind: rule.kind,
        start,
        end: start + value.length,
        reason: rule.reason,
      });
    }
  }
  const rank = (d: Detection) => (d.kind === "SECRET" ? 0 : 1);
  const chosen: Detection[] = [];
  for (const d of found.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start,
  )) {
    if (!chosen.some((x) => d.start < x.end && d.end > x.start)) chosen.push(d);
  }
  return chosen.sort((a, b) => a.start - b.start);
}
export function sanitize(text: string, strict = false): Result {
  const detections = detect(text);
  const maps = new Map<string, string>();
  const counts: Partial<Record<Kind, number>> = {};
  const replacements = detections.map((d) => {
    const key = d.kind + ":" + text.slice(d.start, d.end).toLocaleLowerCase();
    if (!maps.has(key)) {
      const n = (counts[d.kind] = (counts[d.kind] ?? 0) + 1);
      const value =
        d.kind === "SECRET"
          ? "[REDACTED_SECRET]"
          : strict
            ? "[REDACTED_PRIVATE]"
            : d.kind === "EMAIL"
              ? `person-${n}@example.invalid`
              : d.kind === "PERSON_NAME"
                ? `Person ${n}`
                : d.kind === "PHONE"
                  ? "[PHONE_REDACTED]"
                  : d.kind === "UNKNOWN"
                    ? "[PRIVATE_FIELD_REDACTED]"
                    : `DEMO-${d.kind === "ACCOUNT_ID" ? "ACCOUNT" : "CUSTOMER"}-${String(n).padStart(3, "0")}`;
      maps.set(key, value);
    }
    return maps.get(key)!;
  });
  let sanitizedText = text;
  for (let i = detections.length - 1; i >= 0; i--) {
    const d = detections[i];
    sanitizedText =
      sanitizedText.slice(0, d.start) +
      replacements[i] +
      sanitizedText.slice(d.end);
  }
  return {
    sanitizedText,
    detections: detections.map((d, i) => ({
      ...d,
      replacement: replacements[i],
    })),
    status: detections.some((d) => d.kind === "UNKNOWN")
      ? "REVIEW_REQUIRED"
      : "READY_FOR_REVIEW",
  };
}
export function validateOutput(original: string, output: string): boolean {
  if (!output.trim() || output.length > 100_000) return false;
  const privateSpans = detect(original);
  if (
    privateSpans.some((d) =>
      output
        .toLocaleLowerCase()
        .includes(original.slice(d.start, d.end).toLocaleLowerCase()),
    )
  )
    return false;
  return !detect(output).some(
    (d) =>
      d.kind === "SECRET" ||
      d.kind === "UNKNOWN" ||
      d.kind === "PHONE" ||
      d.kind === "ACCOUNT_ID" ||
      d.kind === "CUSTOMER_ID" ||
      (d.kind === "EMAIL" &&
        !output.slice(d.start, d.end).endsWith("@example.invalid")),
  );
}
export const sample =
  "Customer Aditya ordered 2 units for ₹2,500.\nContact aditya@example.com about order CUST-78291.\nCustomer Aditya requested a return for CUST-78291.\nPhone: +91 98765 43210\nAuthorization: Bearer demo_sensitive_token_1234567890";
