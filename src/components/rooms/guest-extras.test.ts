import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extrasTotals, shiftBriefCounts } from "./guest-extras";
import type { Room, ReceptionItem } from "@/lib/app-types";
import type { FlagDef } from "@/lib/room-flags";
import type { GuestExtra } from "@/lib/guest-extras-rules";

const room = (p: Partial<Room>): Room => ({ room_number: 1, sheet_kind: null, ...p } as Room);
const statuses = [{ id: "arrival", label: "Arrival" }, { id: "stayover", label: "Stayover" }] as ReceptionItem[];
const flag = (key: string, p: Partial<FlagDef> = {}): FlagDef => ({ key, label: key, icon: "flag", color: "pink", hidden: false, custom: false, sort: 0, ...p });

describe("Today's brief counts", () => {
  it("counts each paperwork job before falling back to status for rooms without paperwork", () => {
    const counts = shiftBriefCounts([
      room({ sheet_kind: "departure", reception_status_id: "arrival" }),
      room({ sheet_kind: "turnover" }), room({ sheet_kind: "arrival" }), room({ sheet_kind: "stayover" }),
      room({ reception_status_id: "arrival" }), room({ default_status: "stayover" }),
      room({ sheet_kind: "vacant", reception_status_id: "arrival" }),
    ], statuses, [], []);
    assert.deepEqual(counts.jobs, { departure: 1, turnover: 1, arrival: 2, stayover: 2 });
  });
  it("counts tonight's guests only for guest jobs using the extras guest override first", () => {
    const counts = shiftBriefCounts([
      room({ sheet_kind: "departure", guest_extras_guests: 9 }),
      room({ sheet_kind: "turnover", sheet_guests: 2, guest_extras_guests: 3 }),
      room({ sheet_kind: "stayover", sheet_guests: 2 }),
      room({ reception_status_id: "arrival" }),
    ], statuses, [], []);
    assert.equal(counts.guests, 5);
  });
  it("excludes hidden and day-changing flags, counts built-in and custom flags once per room in order", () => {
    const counts = shiftBriefCounts([room({ dog_box: true, early_check_in: true, guest_vacated: true, stayover_out: true }), room({ room_number: 2 })], statuses,
      [flag("guest_vacated"), flag("stayover_out"), flag("early_check_in", { hidden: true }), flag("custom", { custom: true }), flag("dog_box"), flag("late_checkout")],
      [{ id: "a", room_number: 1, flag_key: "custom" }, { id: "b", room_number: 1, flag_key: "custom" }]);
    assert.deepEqual(counts.flags.map((f) => [f.def.key, f.count]), [["custom", 1], ["dog_box", 1]]);
  });
  it("counts only unfinished leave extras as left while keeping completed quantities in the total", () => {
    const water: GuestExtra = { id: "water", name: "Water", kind: "leave", icon: "gift", sort_order: 0 };
    const totals = extrasTotals([room({ room_number: 1 }), room({ room_number: 2 })], (r) => [
      { extra: water, quantity: r.room_number === 1 ? 2 : 3, done: r.room_number === 1 },
      { extra: { ...water, id: "check", kind: "check" }, quantity: 1, done: false },
    ]);
    assert.deepEqual(totals.map((t) => [t.extra.id, t.total, t.left]), [["water", 5, 3]]);
  });
});