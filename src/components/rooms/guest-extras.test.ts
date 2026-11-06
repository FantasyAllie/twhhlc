import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extrasTotals, shiftBriefCounts } from "./guest-extras";
import type { Room } from "@/lib/app-types";
import type { FlagDef } from "@/lib/room-flags";
import type { GuestExtra } from "@/lib/guest-extras-rules";

const room = (p: Partial<Room>): Room => ({ room_number: 1, sheet_kind: null, ...p } as Room);
const flag = (key: string, p: Partial<FlagDef> = {}): FlagDef => ({ key, label: key, icon: "flag", color: "pink", hidden: false, custom: false, sort: 0, ...p });

describe("Today's brief counts", () => {
  it("counts only the paperwork's jobs, never room statuses", () => {
    const counts = shiftBriefCounts([
      room({ sheet_kind: "departure", reception_status_id: "arrival" }),
      room({ sheet_kind: "turnover" }), room({ sheet_kind: "arrival" }), room({ sheet_kind: "stayover" }),
      room({ reception_status_id: "arrival" }), room({ default_status: "stayover" }),
      room({ sheet_kind: "vacant", reception_status_id: "arrival" }),
    ], [], []);
    assert.equal(counts.hasPaperwork, true);
    assert.deepEqual(counts.jobs, { departure: 1, turnover: 1, arrival: 1, stayover: 1 });
  });
  it("has no brief without paperwork", () => {
    const counts = shiftBriefCounts([room({ reception_status_id: "arrival" }), room({ default_status: "stayover" })], [], []);
    assert.equal(counts.hasPaperwork, false);
    assert.deepEqual(counts.jobs, { departure: 0, turnover: 0, arrival: 0, stayover: 0 });
  });
  it("counts tonight's guests from the paperwork only, ignoring the extras guest override", () => {
    const counts = shiftBriefCounts([
      room({ sheet_kind: "departure", sheet_guests: 4, guest_extras_guests: 9 }),
      room({ sheet_kind: "turnover", sheet_guests: 2, guest_extras_guests: 3 }),
      room({ sheet_kind: "stayover", sheet_guests: 2 }),
      room({ reception_status_id: "arrival", guest_extras_guests: 2 }),
    ], [], []);
    assert.equal(counts.guests, 4);
  });
  it("excludes hidden and day-changing flags, counts built-in and custom flags once per room in order", () => {
    const counts = shiftBriefCounts([room({ dog_box: true, early_check_in: true, guest_vacated: true, stayover_out: true }), room({ room_number: 2 })],
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