import { validateOutput } from "../../../packages/privacy-core";
import { isExtension } from "./runtime";
function checked(original: string, output: string, reviewed: boolean) {
  if (!reviewed || !validateOutput(original, output))
    throw new Error(
      "Review the sanitized preview and remove remaining private details first.",
    );
  return output;
}
export async function askGemini(
  original: string,
  output: string,
  reviewed: boolean,
) {
  return openChosenAi("Gemini", original, output, reviewed);
}
export type AiDestination = "Gemini" | "ChatGPT" | "Claude";
export async function openChosenAi(
  destination: AiDestination,
  original: string,
  output: string,
  reviewed: boolean,
) {
  const text = checked(original, output, reviewed);
  await navigator.clipboard.writeText(text);
  const url = {
    Gemini: "https://gemini.google.com/app",
    ChatGPT: "https://chatgpt.com/",
    Claude: "https://claude.ai/new",
  }[destination];
  // Never put source content (or sanitized content) in a URL or automatic request.
  if (isExtension) await chrome.tabs.create({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
}
export async function openMeetingView(
  original: string,
  output: string,
  reviewed: boolean,
) {
  const text = checked(original, output, reviewed);
  if (!isExtension)
    throw new Error(
      "Install the extension to open an isolated meeting tab. This website is a preview only.",
    );
  const channel = crypto.randomUUID();
  // A page-to-page handshake transfers only the reviewed result. No storage or URL payload.
  const target = await chrome.tabs.create({
    url: chrome.runtime.getURL(`present.html#${channel}`),
  });
  const listener = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    reply: (value: unknown) => void,
  ) => {
    if (
      typeof message !== "object" ||
      !message ||
      !("type" in message) ||
      !("channel" in message)
    )
      return;
    if (
      message.type === "MEETING_READY" &&
      message.channel === channel &&
      sender.id === chrome.runtime.id &&
      sender.url === chrome.runtime.getURL(`present.html#${channel}`) &&
      (!sender.tab || sender.tab.id === target.id)
    ) {
      reply({ text });
      chrome.runtime.onMessage.removeListener(listener);
      clearTimeout(timer);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  const timer = setTimeout(
    () => chrome.runtime.onMessage.removeListener(listener),
    15000,
  );
}
