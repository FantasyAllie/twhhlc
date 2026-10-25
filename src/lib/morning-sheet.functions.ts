import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ParsedSheetRoom } from "@/lib/morning-sheet";

const PROMPT = `This PDF is a hotel's daily House Room Status report. Return one entry per room row, every room in the document, in order.
- night: the Night column exactly (e.g. "0/1", "3/4"), or null.
- occupancy: "out_of_service" if the room is marked Room Out Of Service; "departure" if the guest departs today or the row says Departure/Dirty; "occupied" for a guest mid-stay; otherwise "vacant".
- arriving_today: true when a guest arrives today (night starts with 0/ or arrival date is the report date).
- departing_today: true when the current guest leaves today (night like 4/4, or departure date equals report date).
- A row explicitly marked CLEAN / ARRIVAL is an arrival into an already clean room: occupancy "vacant", arriving_today true, departing_today false. Do not infer a departure just because an arrival is scheduled. Only a real same-day departing guest makes it a turnover.
- adults/children/infants: from the Ad Ch Inf columns, 0 if blank.
- bed: from housekeeping notes: TWIN -> twin, KING -> king, DOUBLE -> double, else null.
- dog: true if notes mention DOG.
- eci: true if notes mention ECI (early check-in).
- lco: true if notes mention LCO (late check-out).
- notes: the housekeeping notes with the TWIN/KING/DOUBLE/DOG/ECI/LCO keywords removed and trimmed, or null if nothing remains.
- room_type: the Room Type column exactly (e.g. "SUP_TW_KING", "FAMILY"), or null.
- For a room where one guest departs and another arrives today, adults/children/infants are the ARRIVING guests.
- sheet_date: the report date as YYYY-MM-DD, or null.`;

const room = {
  type: "object", additionalProperties: false,
  required: ["room_number", "night", "occupancy", "arriving_today", "departing_today", "adults", "children", "infants", "lead_name", "bed", "dog", "eci", "lco", "notes", "room_type"],
  properties: {
    room_number: { type: "integer" }, night: { type: ["string", "null"] },
    occupancy: { type: "string", enum: ["vacant", "occupied", "departure", "out_of_service"] },
    arriving_today: { type: "boolean" }, departing_today: { type: "boolean" },
    adults: { type: "integer" }, children: { type: "integer" }, infants: { type: "integer" },
    lead_name: { type: ["string", "null"] }, bed: { type: ["string", "null"], enum: ["twin", "double", "king", null] },
    dog: { type: "boolean" }, eci: { type: "boolean" }, lco: { type: "boolean" }, notes: { type: ["string", "null"] }, room_type: { type: ["string", "null"] },
  },
};
const schema = {
  type: "object", additionalProperties: false, required: ["sheet_date", "rooms"],
  properties: { sheet_date: { type: ["string", "null"] }, rooms: { type: "array", items: room } },
};

/** Reads the uploaded morning PDF and returns its room rows. Nothing is saved here. */
export const parseMorningSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileBase64: string }) => {
    if (typeof d?.fileBase64 !== "string" || d.fileBase64.length < 100) throw new Error("No PDF provided");
    if (d.fileBase64.length > 14_000_000) throw new Error("PDF is too large (10 MB max)");
    return d;
  })
  .handler(async ({ data }): Promise<{ sheet_date: string | null; rooms: ParsedSheetRoom[] }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Document reading is not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "morning_sheet", strict: true, schema } },
        input: [{ role: "user", content: [
          { type: "input_text", text: PROMPT },
          { type: "input_file", filename: "morning-sheet.pdf", file_data: `data:application/pdf;base64,${data.fileBase64}` },
        ] }],
      }),
    });
    if (res.status === 429) throw new Error("Too many requests right now — try again in a minute.");
    if (res.status === 402) throw new Error("AI credits have run out for this workspace.");
    if (!res.ok || !res.body) {
      console.error("morning sheet parse failed", res.status, await res.text().catch(() => ""));
      throw new Error("Couldn't read that PDF. Please try again.");
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const e = JSON.parse(line.slice(5).trim());
          if (e.type === "response.output_text.delta") out += e.delta;
        } catch { /* keep-alive */ }
      }
    }
    try {
      const parsed = JSON.parse(out) as { sheet_date: string | null; rooms: ParsedSheetRoom[] };
      if (!Array.isArray(parsed.rooms) || parsed.rooms.length === 0) throw new Error("empty");
      return parsed;
    } catch {
      throw new Error("That doesn't look like a House Room Status report.");
    }
  });
