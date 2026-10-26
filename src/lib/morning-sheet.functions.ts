import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads the uploaded morning PDF and returns its room rows. Nothing is saved here. */
export const parseMorningSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileBase64: string }) => {
    if (typeof d?.fileBase64 !== "string" || d.fileBase64.length < 100) throw new Error("No PDF provided");
    if (d.fileBase64.length > 14_000_000) throw new Error("PDF is too large (10 MB max)");
    return d;
  })
  .handler(async ({ data }) => {
    const { readMorningSheetPdf } = await import("./morning-sheet-pdf.server");
    return readMorningSheetPdf(data.fileBase64);
  });
