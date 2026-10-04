import { SemanticReview } from "./semantic-review";
import { semanticOcrCandidates, splitOcrColumns } from "./semantic-ocr";
import { confidencePolicy, priority } from "../../../packages/semantic-core";
import React, { useRef, useState, useEffect } from "react";
import { createWorker, PSM } from "tesseract.js";
import { detect } from "../../../packages/privacy-core";
import { sensitiveOcrLines, type OcrLine } from "../../../packages/field-core";
import { capture, isExtension } from "./runtime";
type Box = { x: number; y: number; w: number; h: number; forceHide?: boolean };
export function Screenshot() {
  const canvas = useRef<HTMLCanvasElement>(null),
    image = useRef<HTMLImageElement | null>(null),
    start = useRef<{ x: number; y: number } | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]),
    [loaded, setLoaded] = useState(false),
    [note, setNote] = useState(
      "Import a PNG or JPEG. The image stays on this device.",
    ),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const worker = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null),
    generation = useRef(0);
  const [ocrLines, setOcrLines] = useState<OcrLine[]>([]);
  const [treatment, setTreatment] = useState<"blur" | "hide">("hide");
  const draw = () => {
    const c = canvas.current,
      img = image.current;
    if (!c || !img) return;
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = "#101412";
    boxes.forEach((b) => {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      if (treatment === "blur" && !b.forceHide) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.w, b.h);
        ctx.clip();
        ctx.filter = "blur(16px)";
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      }
    });
  };
  useEffect(draw, [boxes, loaded, treatment]);
  useEffect(
    () => () => {
      generation.current++;
      void worker.current?.terminate();
      image.current = null;
    },
    [],
  );
  const load = (url: string) => {
    const loadToken = ++generation.current;
    setOcrLines([]);
    void worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    const img = new Image();
    img.onload = () => {
      if (loadToken !== generation.current) return;
      if (img.width * img.height > 16_000_000) {
        setNote("Use an image below 16 megapixels.");
        return;
      }
      image.current = img;
      setLoaded(true);
      setBoxes([]);
      setReviewed(false);
      setNote(
        "Drag over private areas to paint permanent redactions. Run local OCR for suggested areas.",
      );
    };
    img.onerror = () => {
      if (loadToken === generation.current)
        setNote("Could not decode this image. Try a PNG or JPEG.");
    };
    img.src = url;
  };
  async function ocr() {
    if (!canvas.current) return;
    const token = ++generation.current;
    setOcrLines([]);
    setBusy(true);
    setReviewed(false);
    setNote("Reading locally with packaged OCR. No image upload.");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      timeout = setTimeout(() => {
        if (token === generation.current) {
          generation.current++;
          void worker.current?.terminate();
          worker.current = null;
          setBusy(false);
          setNote("OCR timed out. Review image manually.");
        }
      }, 60_000);
      const base = isExtension
        ? chrome.runtime.getURL("ocr/")
        : new URL("/ocr/", location.origin).href;
      const w = await createWorker("eng", 1, {
        workerPath: base + "worker.min.js",
        corePath: base,
        langPath: base,
        workerBlobURL: false,
        gzip: true,
        cacheMethod: "none",
      });
      if (token !== generation.current) {
        await w.terminate();
        return;
      }
      worker.current = w;
      // Sparse mode reads individual cells in forms instead of merging rows
      // across ruled table columns. OCR and all pixel work remain on device.
      await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const result = await w.recognize(
        image.current!,
        {},
        { blocks: true, text: true },
      );
      if (token !== generation.current) return;
      const found: Box[] = [];
      const lines: OcrLine[] = [];
      for (const block of result.data.blocks ?? [])
        for (const para of block.paragraphs)
          for (const line of para.lines) {
            lines.push(...splitOcrColumns(line));
          }
      setOcrLines(lines);
      const secretRows = new Set(
        sensitiveOcrLines(
          lines,
          (text) => detect(text).some((d) => d.kind === "SECRET"),
          ["SECRET"],
        ),
      );
      for (const line of sensitiveOcrLines(
        lines,
        (text) => detect(text).length > 0,
      )) {
        const b = line.bbox;
        found.push({
          x: Math.max(0, b.x0 - 4),
          y: Math.max(0, b.y0 - 4),
          w: b.x1 - b.x0 + 8,
          h: b.y1 - b.y0 + 8,
          forceHide: secretRows.has(line),
        });
      }
      setBoxes((old) => [...old, ...found]);
      setNote(
        found.length
          ? `${found.length} sensitive lines suggested, including labelled personal-field rows. OCR cannot identify faces or signatures: draw covers over them and inspect every remaining pixel before export.`
          : "No supported sensitive line was recognized. This is not a safety result: OCR may have missed the form. Draw covers over unreadable values, photos and signatures.",
      );
    } catch {
      if (token === generation.current)
        setNote(
          "OCR unavailable. Review image manually and draw redaction boxes.",
        );
    } finally {
      clearTimeout(timeout);
      if (token === generation.current) {
        await worker.current?.terminate();
        worker.current = null;
        setBusy(false);
      }
    }
  }
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!,
      r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  };
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Keep the context. Hide the private details.</h2>
          <p>Local OCR + permanent pixel redaction</p>
        </div>
        <span className="chip">On device</span>
      </div>
      <div className="actions">
        <label>
          Screenshot treatment
          <select
            aria-label="Screenshot treatment"
            value={treatment}
            onChange={(event) => {
              setTreatment(event.target.value as "blur" | "hide");
              setReviewed(false);
            }}
          >
            <option value="hide">Hide — opaque cover</option>
            <option value="blur">Blur — preserve visual context</option>
          </select>
        </label>
        <label className="button primary">
          Import screenshot
          <input
            aria-label="Import screenshot"
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (
                !["image/png", "image/jpeg"].includes(f.type) ||
                f.size > 10_000_000
              ) {
                setNote("Use a PNG/JPEG under 10 MB.");
                return;
              }
              const r = new FileReader();
              r.onload = () => load(String(r.result));
              r.readAsDataURL(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          onClick={() =>
            void capture()
              .then(load)
              .catch((e) => setNote(e.message))
          }
        >
          Capture current tab
        </button>
        {loaded && (
          <>
            <button disabled={busy} onClick={() => void ocr()}>
              Scan with local OCR
            </button>
            <button
              disabled={!boxes.length}
              onClick={() => {
                setBoxes((b) => b.slice(0, -1));
                setReviewed(false);
              }}
            >
              Undo rectangle
            </button>
            <button
              onClick={() => {
                generation.current++;
                void worker.current?.terminate();
                worker.current = null;
                image.current = null;
                if (canvas.current) {
                  canvas.current.width = 0;
                  canvas.current.height = 0;
                }
                setLoaded(false);
                setBoxes([]);
                setBusy(false);
                setNote("Image cleared.");
              }}
            >
              Clear image
            </button>
          </>
        )}
      </div>
      <p role="status" className="notice">
        {note}
      </p>
      {loaded && ocrLines.length > 0 && (
        <SemanticReview
          key={generation.current}
          purpose="redact local OCR"
          onNotice={setNote}
          prepare={async () => ({
            ...semanticOcrCandidates(ocrLines),
            nonce: String(generation.current),
            localCount: boxes.length,
          })}
          apply={async (snapshot, decisions, reviewedIds) => {
            if (snapshot.nonce !== String(generation.current))
              throw new Error("Image changed. Run OCR again.");
            const found: Box[] = [];
            for (const d of decisions) {
              if (
                !reviewedIds.includes(d.id) &&
                priority[confidencePolicy(d).action] < priority.ALIAS
              )
                continue;
              for (const line of snapshot.rows.get(d.id) ?? []) {
                const b = line.bbox;
                found.push({
                  x: Math.max(0, b.x0 - 4),
                  y: Math.max(0, b.y0 - 4),
                  w: b.x1 - b.x0 + 8,
                  h: b.y1 - b.y0 + 8,
                  forceHide:
                    d.category === "AUTH_SECRET" || d.action === "HIDE",
                });
              }
            }
            setBoxes((old) => [...old, ...found]);
            setReviewed(false);
          }}
        />
      )}
      {!loaded && (
        <div className="image-empty">
          <span className="large-icon">▧</span>
          <h3>A clean screenshot starts here.</h3>
          <p>
            PNG or JPEG · up to 10 MB / 16 megapixels
            <br />
            Nothing is uploaded or saved automatically.
          </p>
        </div>
      )}
      <canvas
        aria-label="Screenshot redaction canvas"
        hidden={!loaded}
        ref={canvas}
        onPointerDown={(e) => {
          start.current = point(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (!start.current) return;
          const a = start.current,
            b = point(e);
          start.current = null;
          if (Math.abs(a.x - b.x) > 2 && Math.abs(a.y - b.y) > 2) {
            setBoxes((old) => [
              ...old,
              {
                x: Math.min(a.x, b.x),
                y: Math.min(a.y, b.y),
                w: Math.abs(a.x - b.x),
                h: Math.abs(a.y - b.y),
              },
            ]);
            setReviewed(false);
          }
        }}
      />
      {loaded && (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I inspected the whole image, including details OCR may miss.
          </label>
          <button
            className="primary"
            disabled={!reviewed || busy}
            onClick={() => {
              const output = document.createElement("canvas");
              output.width = canvas.current!.width;
              output.height = canvas.current!.height;
              output.getContext("2d")!.drawImage(canvas.current!, 0, 0);
              output.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "privacyshield-redacted.png";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }, "image/png");
            }}
          >
            Download redacted PNG
          </button>
        </>
      )}
    </section>
  );
}
