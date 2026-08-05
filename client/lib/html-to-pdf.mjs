/**
 * Render a local HTML file to PDF via Chrome (puppeteer-core).
 * Uses system Chrome/Chromium; override with CHROME_PATH / PUPPETEER_EXECUTABLE_PATH.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const CANDIDATE_CHROMES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function resolveChromeExecutable() {
  for (const p of CANDIDATE_CHROMES) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * @param {string} htmlFilePath absolute path to .html
 * @param {string} [pdfFilePath] defaults to same basename with .pdf
 * @returns {Promise<string>} absolute path of written PDF
 */
export async function htmlFileToPdf(htmlFilePath, pdfFilePath) {
  const chrome = resolveChromeExecutable();
  if (!chrome) {
    const err = new Error(
      "Geen Chrome/Chromium gevonden voor PDF — zet CHROME_PATH of installeer Google Chrome",
    );
    err.code = "NO_CHROME";
    throw err;
  }
  const out =
    pdfFilePath ||
    path.join(path.dirname(htmlFilePath), `${path.basename(htmlFilePath, ".html")}.pdf`);

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=medium"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(htmlFilePath)).href, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });
    await page.pdf({
      path: out,
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" },
    });
  } finally {
    await browser.close().catch(() => {});
  }
  return out;
}

export function pdfNameFromHtml(htmlFilename) {
  if (!htmlFilename.endsWith(".html")) return `${htmlFilename}.pdf`;
  return `${htmlFilename.slice(0, -5)}.pdf`;
}
