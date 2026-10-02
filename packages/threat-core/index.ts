import { parse } from "tldts";
export interface Finding {
  code: string;
  title: string;
  explanation: string;
  source: string;
}
export interface Assessment {
  outcome: "KNOWN_THREAT" | "SUSPICIOUS" | "UNKNOWN";
  findings: Finding[];
  checkedAt: string;
  lookupStatus: "LOCAL_ONLY";
  subject: string;
}
export function checkUrl(raw: string): Assessment {
  if (raw.length > 8192) throw new Error("URL is too long.");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Enter a complete URL beginning with https:// or http://.");
  }
  if (!["https:", "http:"].includes(u.protocol))
    throw new Error("Only HTTP and HTTPS links can be checked.");
  const findings: Finding[] = [];
  const add = (code: string, title: string, explanation: string) =>
    findings.push({
      code,
      title,
      explanation,
      source: "Local rules (heuristic)",
    });
  if (u.username || u.password)
    add(
      "USERINFO",
      "Credentials or misleading user information",
      "The real destination is the host after @. Embedded credentials are not shown.",
    );
  if (u.protocol === "http:")
    add(
      "HTTP",
      "Unencrypted connection",
      "HTTP does not encrypt traffic. This alone does not establish fraud.",
    );
  if (u.hostname.includes("xn--"))
    add(
      "IDN",
      "Internationalized hostname",
      "Unicode domains may resemble other organizations. Check the exact destination.",
    );
  const domain = parse(u.hostname);
  if (domain.isIp)
    add(
      "IP",
      "IP-address destination",
      "An IP address offers no recognizable organization identity.",
    );
  if (u.port)
    add(
      "PORT",
      "Non-default port",
      "Verify that this port is expected for the service.",
    );
  if (
    [...u.searchParams.keys()].some((k) => /redirect|next|return|url/i.test(k))
  )
    add(
      "REDIRECT",
      "Redirect parameter present",
      "The final destination may differ. No redirects were followed.",
    );
  if (
    /(?:paypal|microsoft|google|apple|amazon)[-.]/i.test(u.hostname) &&
    ![
      "paypal.com",
      "microsoft.com",
      "google.com",
      "apple.com",
      "amazon.com",
    ].includes(domain.domain ?? "")
  )
    add(
      "BRAND",
      "Possible brand impersonation",
      "A familiar name appears outside its expected registered domain. Verify independently.",
    );
  const fixture = u.hostname === "known-threat.privacyshield.test";
  if (fixture)
    findings.push({
      code: "DEMO_MATCH",
      title: "Demo reputation match",
      explanation:
        "Synthetic threat fixture only. This is not live threat intelligence.",
      source: "Bundled synthetic test fixture v1",
    });
  return {
    outcome: fixture
      ? "KNOWN_THREAT"
      : findings.length
        ? "SUSPICIOUS"
        : "UNKNOWN",
    findings,
    checkedAt: new Date().toISOString(),
    lookupStatus: "LOCAL_ONLY",
    subject: u.hostname + (u.port ? ":" + u.port : ""),
  };
}
export function checkMessage(text: string): Assessment {
  if (!text.trim() || text.length > 100_000)
    throw new Error("Paste a message of up to 100,000 characters.");
  const findings: Finding[] = [];
  for (const [code, re, title, explanation] of [
    [
      "CREDENTIAL",
      /\b(otp|password|pin|cvv|verification code|seed phrase)\b/i,
      "Credential request",
      "Do not share authentication codes, passwords, or recovery phrases.",
    ],
    [
      "URGENCY",
      /\b(urgent|immediately|suspend|arrest|expire|last chance|within \d+ minutes)\b/i,
      "Pressure to act",
      "Urgency and threats can discourage independent verification.",
    ],
    [
      "PAYMENT",
      /\b(gift card|crypto|wire transfer|pay now|upi|advance fee)\b/i,
      "Payment pressure",
      "A familiar gateway does not verify the merchant or recipient.",
    ],
  ] as const)
    if (re.test(text))
      findings.push({
        code,
        title,
        explanation,
        source: "Local message rules (heuristic)",
      });
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    try {
      findings.push(...checkUrl(match[0]).findings);
    } catch {
      /* Invalid links remain unverified. */
    }
  }
  return {
    outcome: findings.length ? "SUSPICIOUS" : "UNKNOWN",
    findings,
    checkedAt: new Date().toISOString(),
    lookupStatus: "LOCAL_ONLY",
    subject: "Pasted message",
  };
}
