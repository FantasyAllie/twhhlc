import type { ParsedSheetRoom } from "./morning-sheet";

export type ReportTextItem = { text: string; x: number; y: number };
const HEADINGS = ["Room ID", "Room Type", "Sub Group", "Room Status", "Housekeeping Status", "Occupied From", "Occupied To", "Lead Name", "Ad", "Ch", "Inf", "Night", "Room Section"];
const FORMAT_ERROR = "Please upload the Room Status Report exported from your hotel program. Scanned PDFs and blank room sheets aren't supported.";

function lines(items: ReportTextItem[]): ReportTextItem[][] {
  const result: ReportTextItem[][] = [];
  for (const item of [...items].filter(i => i.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = result.find(l => Math.abs(l[0].y - item.y) < 2);
    if (line) line.push(item); else result.push([item]);
  }
  return result.map(l => l.sort((a, b) => a.x - b.x));
}

function reportDate(text: string): string | null {
  const m = text.match(/\bon\s+(?:the\s+)?(\d{1,2})\/([a-z]{3})\/(\d{4})\b/i);
  if (!m) return null;
  return dateValue(`${m[1]}/${m[2]}/${m[3]}`);
}

function dateValue(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/([a-z]{3})\/(\d{4})$/i);
  if (!m) return null;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].toLowerCase());
  const day = Number(m[1]), year = Number(m[3]);
  if (month < 0 || new Date(Date.UTC(year, month, day)).getUTCDate() !== day) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Read column positions from each repeated header; never guess at a different layout. */
export function parseReportPages(pages: ReportTextItem[][]): { sheet_date: string; rooms: ParsedSheetRoom[] } {
  const allLines = pages.flatMap(lines);
  const dates = new Set(allLines.map(l => reportDate(l.map(i => i.text).join(" "))).filter((d): d is string => !!d));
  if (dates.size !== 1) throw new Error("Couldn't find one report date. Please export the Room Status Report again.");
  const sheet_date = [...dates][0];
  const rooms = new Map<number, ParsedSheetRoom>();
  for (const page of pages) {
    const pageLines = lines(page);
    const header = pageLines.find(l => HEADINGS.every(h => l.some(i => i.text.trim() === h)));
    if (!header) throw new Error(FORMAT_ERROR);
    const columns = HEADINGS.map(h => header.find(i => i.text.trim() === h)?.x ?? 0);
    const stopLine = pageLines.find(l => /ROOS\s*\/\s*DFS|Page\s+\d+\s+of/i.test(l.map(i => i.text).join(" ")) && l[0].y < header[0].y);
    const bottom = stopLine?.[0].y ?? 0;
    const body = page.filter(i => i.text.trim() && i.y < header[0].y - 2 && i.y > bottom + 2);
    const starts = body.filter(i => Math.abs(i.x - columns[0]) < 3 && /^\d+$/.test(i.text.trim())).sort((a, b) => b.y - a.y);
    if (!starts.length) throw new Error(FORMAT_ERROR);
    for (let index = 0; index < starts.length; index++) {
      const start = starts[index];
      // Multi-line status can extend above the numeric room baseline; the midpoint preserves it.
      const top = index === 0 ? header[0].y - 2 : (starts[index - 1].y + start.y) / 2;
      const next = starts[index + 1];
      const lower = next ? (start.y + next.y) / 2 : bottom + 2;
      const row = body.filter(i => i.y <= top && i.y > lower);
      const noteLines = lines(row).filter(l => l.some(i => /Housekeeping Notes\s*:/i.test(i.text)));
      const noteItems = new Set(noteLines.flat());
      const cells = columns.map((x, c) => lines(row.filter(i => !noteItems.has(i) && i.x >= x - 2 && (c === columns.length - 1 || i.x < columns[c + 1] - 2)))
        .map(l => l.map(i => i.text.trim()).join(" ")).join(" ").trim());
      const status = cells[3];
      if (!/^(Vacant|Occupied|Room Out Of Service)$/i.test(status) || !cells[1]) throw new Error(`Couldn't read room ${start.text}. Please export the report again.`);
      const count = (c: number) => {
        if (!/^\d+$/.test(cells[c])) throw new Error(`Couldn't read guest counts for room ${start.text}.`);
        return Number(cells[c]);
      };
      const night = cells[11] || null;
      if (night && !/^\d+\s*\/\s*\d+$/.test(night)) throw new Error(`Couldn't read the Night column for room ${start.text}.`);
      const [elapsed, total] = night?.split("/").map(Number) ?? [];
      const cleanArrival = /CLEAN\s*\/\s*ARRIVAL/i.test(cells[4]);
      const arriving = cleanArrival || elapsed === 0 || dateValue(cells[5]) === sheet_date;
      const departing = !cleanArrival && (/Departure|Dirty/i.test(cells[4]) || (total > 0 && elapsed === total) || dateValue(cells[6]) === sheet_date);
      const rawNotes = noteLines.map(l => l.map(i => i.text).join(" ")).join(" ").replace(/Housekeeping Notes\s*:\s*/ig, "").trim();
      const bedMatch = rawNotes.match(/\b(TWIN|KING|DOUBLE)\b/i);
      const parsed: ParsedSheetRoom = {
        room_number: Number(start.text), room_type: cells[1], night,
        occupancy: /Out Of Service/i.test(status) ? "out_of_service" : departing ? "departure" : /^Occupied$/i.test(status) ? "occupied" : "vacant",
        arriving_today: arriving, departing_today: departing,
        adults: count(8), children: count(9), infants: count(10), lead_name: cells[7] || null,
        bed: bedMatch ? bedMatch[1].toLowerCase() as ParsedSheetRoom["bed"] : null,
        dog: /\bDOG\b/i.test(rawNotes), eci: /\bECI\b/i.test(rawNotes), lco: /\bLCO\b/i.test(rawNotes),
        notes: rawNotes.replace(/\b(TWIN|KING|DOUBLE|DOG|ECI|LCO)\b/ig, "").replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "").replace(/\s+/g, " ") || null,
      };
      const previous = rooms.get(parsed.room_number);
      if (!previous) rooms.set(parsed.room_number, parsed);
      else {
        if (previous.arriving_today === parsed.arriving_today) throw new Error(`Room ${parsed.room_number} appears twice with conflicting bookings. Please check the report.`);
        const arrivingRoom = parsed.arriving_today ? parsed : previous;
        rooms.set(parsed.room_number, { ...arrivingRoom, departing_today: previous.departing_today || parsed.departing_today,
          occupancy: previous.occupancy === "out_of_service" || parsed.occupancy === "out_of_service" ? "out_of_service" : previous.departing_today || parsed.departing_today ? "departure" : arrivingRoom.occupancy });
      }
    }
  }
  return { sheet_date, rooms: [...rooms.values()] };
}