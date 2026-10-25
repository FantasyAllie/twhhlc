import { describe, expect, it } from "vitest";
import { buildSheet, classifyRoom, type ParsedSheetRoom } from "./morning-sheet";

const base: ParsedSheetRoom = {
  room_number: 1, night: null, occupancy: "vacant", arriving_today: false, departing_today: false,
  adults: 0, children: 0, infants: 0, lead_name: null, bed: null, dog: false, notes: null,
};

describe("morning sheet rules", () => {
  it("same-day departure and arrival is a turnover that starts Dirty", () => {
    const { rooms } = buildSheet([{ ...base, occupancy: "departure", arriving_today: true }]);
    expect(rooms[0].kind).toBe("turnover");
    expect(rooms[0].status_label).toBe("Dirty");
  });
  it("arrival into an empty room shows Arrival (yellow)", () => {
    expect(classifyRoom({ ...base, arriving_today: true, night: "0/1" })).toBe("arrival");
  });
  it("guest mid-stay is a Stayover (pink)", () => {
    expect(classifyRoom({ ...base, occupancy: "occupied", night: "1/2" })).toBe("stayover");
  });
  it("out of service wins over anything else", () => {
    expect(classifyRoom({ ...base, occupancy: "out_of_service", arriving_today: true })).toBe("ros");
  });
  it("summary counts dogs and guests only for occupied rooms", () => {
    const { summary } = buildSheet([
      { ...base, room_number: 1, arriving_today: true, adults: 2, dog: true },
      { ...base, room_number: 2, occupancy: "out_of_service", adults: 3 },
      { ...base, room_number: 1, arriving_today: true, adults: 9 },
    ]);
    expect(summary.arrival).toBe(1);
    expect(summary.dogs).toBe(1);
    expect(summary.guests).toBe(2);
  });
});
