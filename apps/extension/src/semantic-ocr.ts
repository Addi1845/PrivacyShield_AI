import type { OcrLine } from "../../../packages/field-core";
import {
  reduceCandidate,
  type ReducedCandidate,
} from "../../../packages/semantic-core";
// Tesseract can merge a label and distant value into one line. Large word gaps
// recover columns locally without asking a provider to inspect the whole line.
export function splitOcrColumns(
  line: OcrLine & { words?: OcrLine[] },
): OcrLine[] {
  if (!line.words?.length) return [line];
  const groups: OcrLine[] = [];
  const threshold = Math.max(60, (line.bbox.y1 - line.bbox.y0) * 3);
  for (const word of line.words) {
    const previous = groups.at(-1);
    if (!previous || word.bbox.x0 - previous.bbox.x1 > threshold) {
      groups.push({ text: word.text, bbox: { ...word.bbox } });
    } else {
      previous.text += ` ${word.text}`;
      previous.bbox.x1 = Math.max(previous.bbox.x1, word.bbox.x1);
      previous.bbox.y0 = Math.min(previous.bbox.y0, word.bbox.y0);
      previous.bbox.y1 = Math.max(previous.bbox.y1, word.bbox.y1);
    }
  }
  return groups.length > 1 ? groups : [line];
}
// Only a separate left-hand label can leave the OCR pipeline. Inline prose and
// uncertain geometry stay local for manual review; pixels never leave canvas.
export function semanticOcrCandidates(lines: OcrLine[]) {
  const elements: ReducedCandidate[] = [];
  const rows = new Map<string, OcrLine[]>();
  for (const label of lines) {
    if (elements.length >= 50) break;
    const values = lines.filter((line) => {
      const overlap =
        Math.min(label.bbox.y1, line.bbox.y1) -
        Math.max(label.bbox.y0, line.bbox.y0);
      return (
        line !== label &&
        line.bbox.x0 > label.bbox.x1 &&
        overlap >
          0.5 *
            Math.min(label.bbox.y1 - label.bbox.y0, line.bbox.y1 - line.bbox.y0)
      );
    });
    if (!values.length) continue;
    const id = `e${elements.length}`;
    const candidate = reduceCandidate({
      id,
      label: label.text.trim(),
      text: values.map((v) => v.text).join(" "),
    });
    if (!candidate) continue;
    elements.push(candidate);
    rows.set(id, [label, ...values]);
  }
  return { elements, rows };
}
