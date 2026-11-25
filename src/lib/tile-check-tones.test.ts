import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeTileMeta, paleTone, receptionTileLabel, type RoomStatusFlags } from "./rooms";

const flags = (extra: Partial<RoomStatusFlags>): RoomStatusFlags => ({
  isStaff: false, isDnd: false, isStayover: false, isDirty: false, isClean: false, isArrival: false, isRos: false, hasStatus: true, ...extra,
});
const meta = (
  f: Partial<RoomStatusFlags>, sheetKind: string | null, state: "todo" | "progress" | "done", checkTones: boolean,
  { role = "housekeeping", hasLinenCount = false, isNR = false }: { role?: "housekeeping" | "reception"; hasLinenCount?: boolean; isNR?: boolean } = {},
) => computeTileMeta({ flags: flags(f), state: state as never, isNR, hasLinenCount, earlyCheckIn: false, role, sheetKind, checkTones });

describe("pale dashed tiles (polish preview)", () => {
  it("draws every unfinished room pale and dashed, in its own colour", () => {
    const turnover = meta({ isDirty: true }, "turnover", "todo", true);
    assert.equal(turnover.bg, paleTone("var(--room-dirty)"));
    assert.equal(turnover.pending, true);
    assert.equal(meta({ isDirty: true }, "turnover", "progress", true, { hasLinenCount: true }).bg, paleTone("var(--room-progress)"));
    assert.equal(meta({ isArrival: true }, "arrival", "todo", true).bg, paleTone("var(--room-complete)"));
    assert.equal(meta({ isClean: true }, "vacant", "todo", true).bg, paleTone("var(--room-cleandone)"));
  });

  it("starts unfinished stayovers from the normal stayover blue, so they're lighter than finished ones", () => {
    const job = meta({ isStayover: true }, "stayover", "todo", true);
    assert.equal(job.bg, paleTone("var(--room-stayover)"));
    assert.equal(job.pending, true);
  });

  it("keeps done rooms solid in their full colours", () => {
    assert.equal(meta({ isArrival: true }, "arrival", "done", true).bg, "var(--room-complete)");
    assert.equal(meta({ isClean: true }, "vacant", "done", true).bg, "var(--room-cleandone)");
    assert.equal(meta({ isStayover: true }, null, "done", true).pending, undefined);
  });

  it("leaves ROS, Staff, plain Dirty, DND and NR rooms solid", () => {
    assert.equal(meta({ isRos: true }, null, "todo", true).pending, undefined);
    assert.equal(meta({ isStaff: true }, null, "todo", true).pending, undefined);
    assert.equal(meta({ isDirty: true }, null, "todo", true).pending, undefined);
    assert.equal(meta({ isDnd: true }, null, "todo", true).pending, undefined);
    assert.equal(meta({ isStayover: true }, null, "todo", true, { isNR: true }).pending, undefined);
  });

  it("is exactly today's colours with the preview off", () => {
    const m = meta({ isArrival: true }, "arrival", "todo", false);
    assert.equal(m.label, "Arrival\nNot started");
    assert.equal(m.bg, "var(--room-dirty)");
    assert.equal(m.pending, undefined);
  });
});

describe("reception tile wording (polish preview)", () => {
  it("shows the status without Not started or Not checked", () => {
    assert.equal(receptionTileLabel("Turnover\nNot started", {}), "Turnover");
    assert.equal(receptionTileLabel("Arrival\nNot checked", {}), "Arrival");
    assert.equal(receptionTileLabel("Clean\nNot checked", {}), "Clean");
    assert.equal(receptionTileLabel("Stayover\nNot started", {}), "Stayover");
    assert.equal(receptionTileLabel("ROS", {}), "ROS");
    assert.equal(receptionTileLabel("Turnover\nIn progress", {}), "Turnover\nIn progress");
  });

  it("says late checkout or early check-in on the second line", () => {
    assert.equal(receptionTileLabel("Depart\nNot started", { late_checkout: true }), "Depart\nLate checkout");
    assert.equal(receptionTileLabel("Arrival\nNot checked", { early_check_in: true }), "Arrival\nEarly check-in");
  });

  it("names a stayover whose guest is out", () => {
    assert.equal(receptionTileLabel("Not started", { stayover_out: true }), "Stayover");
  });
});

describe("left dirty today", () => {
  it("reads Dirty, stayovers included, instead of going back to Not started", () => {
    const left = (f: Partial<RoomStatusFlags>, sheetKind: string) =>
      computeTileMeta({ flags: flags(f), state: "todo" as never, isNR: false, hasLinenCount: false, earlyCheckIn: false, role: "housekeeping", sheetKind, leftDirty: "today" });
    assert.equal(left({ isStayover: true }, "stayover").label, "Dirty");
    assert.equal(left({ isDirty: true }, "turnover").label, "Dirty");
  });
});

describe("room bed choices", () => {
  const beds = ["Double", "King", "Super King", "Twin"].map((label) => ({ id: label, label }));
  it("offers Super King or Twin in a Super King room", async () => {
    const { roomBedChoices } = await import("./rooms");
    assert.deepEqual(roomBedChoices(["Super King"], beds).map((b) => b.label), ["King", "Super King", "Twin"]);
  });
  it("offers only Double in a Double room", async () => {
    const { roomBedChoices } = await import("./rooms");
    assert.deepEqual(roomBedChoices(["Double"], beds).map((b) => b.label), ["Double"]);
  });
});

describe("progress ring leaves out ROS", async () => {
  const { leftOutOfProgress } = await import("./rooms");
  it("leaves out Staff and ROS by status", () => {
    assert.equal(leftOutOfProgress("ROS", null), true);
    assert.equal(leftOutOfProgress("staff", "turnover"), true);
  });
  it("leaves out rooms the paperwork lists out of service", () => {
    assert.equal(leftOutOfProgress("clean", "ros"), true);
  });
  it("counts everything else, DND included", () => {
    assert.equal(leftOutOfProgress("dnd", "stayover"), false);
    assert.equal(leftOutOfProgress("dirty", "turnover"), false);
  });
});
