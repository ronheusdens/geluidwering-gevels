/**
 * Hi-res PDF section crop → RGBA for server-side opening discovery.
 */
import { createRequire } from "node:module";
import { createCanvas } from "@napi-rs/canvas";

const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");

pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
  "pdfjs-dist/legacy/build/pdf.worker.min.js",
);

/** pdf.js + @napi-rs/canvas: default NodeCanvasFactory crashes on destroy (width=0). */
const pdfCanvasFactory = {
  create(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const canvas = createCanvas(w, h);
    return { canvas, context: canvas.getContext("2d") };
  },
  reset(canvasAndContext, width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    canvasAndContext.canvas.width = w;
    canvasAndContext.canvas.height = h;
  },
  destroy(canvasAndContext) {
    /* no-op — pdf.js teardown sets width=0 which breaks @napi-rs/canvas */
    if (canvasAndContext) {
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  },
};

/** pdf.js rejects Node Buffer (subclass of Uint8Array) — plain copy required. */
function pdfBytes(raw) {
  if (Buffer.isBuffer(raw)) return new Uint8Array(raw);
  if (raw instanceof Uint8Array) return raw;
  return new Uint8Array(raw);
}

/**
 * @param {Buffer} pdfBuffer
 * @param {{
 *   page_index: number;
 *   x_min: number;
 *   y_min: number;
 *   x_max: number;
 *   y_max: number;
 * }} section
 * @param {number} renderScale PDF render scale (default 6)
 * @returns {Promise<{ width: number; height: number; data: Uint8ClampedArray; colorSpace: string }>}
 */
export async function renderSectionCropRgba(pdfBuffer, section, renderScale = 6) {
  const scale = Number.isFinite(renderScale) ? Math.max(1, Math.min(12, renderScale)) : 6;
  const xMin = Number(section.x_min);
  const yMin = Number(section.y_min);
  const xMax = Number(section.x_max);
  const yMax = Number(section.y_max);
  const pageIndex = Number(section.page_index) || 0;

  if (![xMin, yMin, xMax, yMax].every(Number.isFinite) || xMax <= xMin || yMax <= yMin) {
    throw new Error("invalid section crop bounds");
  }

  const data = pdfBytes(pdfBuffer);
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    canvasFactory: pdfCanvasFactory,
  }).promise;
  const pageNum = Math.min(doc.numPages, Math.max(1, pageIndex + 1));
  const page = await doc.getPage(pageNum);
  const rotation = typeof page.rotate === "number" ? page.rotate : 0;
  const viewport = page.getViewport({ scale, rotation });

  const pageCanvas = pdfCanvasFactory.create(viewport.width, viewport.height);
  await page
    .render({
      canvasContext: pageCanvas.context,
      viewport,
    })
    .promise;

  const fullW = pageCanvas.canvas.width;
  const fullH = pageCanvas.canvas.height;
  const x0 = Math.floor(xMin * fullW);
  const y0 = Math.floor(yMin * fullH);
  const x1 = Math.ceil(xMax * fullW);
  const y1 = Math.ceil(yMax * fullH);
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);

  const crop = createCanvas(cw, ch);
  const cctx = crop.getContext("2d");
  cctx.drawImage(pageCanvas.canvas, x0, y0, cw, ch, 0, 0, cw, ch);

  const img = cctx.getImageData(0, 0, cw, ch);
  return {
    width: cw,
    height: ch,
    data: new Uint8ClampedArray(img.data),
    colorSpace: "srgb",
  };
}
