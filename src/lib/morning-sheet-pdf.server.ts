import { getDocumentProxy } from "unpdf";
import { parseReportPages, type ReportTextItem } from "./morning-sheet-parser";

export async function readMorningSheetPdf(fileBase64: string) {
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0)); }
  catch { throw new Error("Couldn't open that PDF. Please export the report again."); }
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("PDF is too large (10 MB max)");
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("Please choose a PDF room status report.");
  const pdf = await getDocumentProxy(bytes, { isEvalSupported: false, useSystemFonts: false, maxImageSize: 1_000_000 });
  try {
    if (pdf.numPages > 50) throw new Error("The report is too long (50 pages max).");
    const pages: ReportTextItem[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      if (content.items.length > 30_000) throw new Error("The report is too complex. Please export it again.");
      pages.push(content.items.flatMap(i => "str" in i ? [{ text: i.str, x: i.transform[4], y: i.transform[5] }] : []));
      page.cleanup();
    }
    return parseReportPages(pages);
  } finally { await pdf.cleanup(); }
}