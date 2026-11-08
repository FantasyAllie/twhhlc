import { test } from "node:test";
import assert from "node:assert/strict";
import { carriedDirtyCount, isSetAside, leftDirtyState } from "./left-dirty";

const now = new Date(2026, 10, 8, 17, 0);
const today = new Date(2026, 10, 8, 16, 30).toISOString();
const yesterday = new Date(2026, 10, 7, 16, 30).toISOString();

test("left dirty today, earlier, or not at all", () => {
  assert.equal(leftDirtyState({ left_dirty_at: today }, now), "today");
  assert.equal(leftDirtyState({ left_dirty_at: yesterday }, now), "earlier");
  assert.equal(leftDirtyState({ left_dirty_at: null }, now), null);
  assert.equal(leftDirtyState({ left_dirty_at: yesterday, done: true }, now), null);
  assert.equal(leftDirtyState({ left_dirty_at: today, done_reception: true }, now), null);
});

test("left dirty today is set aside, even a paperwork departure", () => {
  assert.equal(isSetAside({ left_dirty_at: today, sheet_kind: "departure" }, true, now), true);
});

test("left dirty yesterday is on today's list again", () => {
  assert.equal(isSetAside({ left_dirty_at: yesterday, sheet_kind: "vacant" }, true, now), false);
});

test("Dirty rooms not on the paperwork stay set aside, as before", () => {
  assert.equal(isSetAside({ sheet_kind: "vacant" }, true, now), true);
  assert.equal(isSetAside({ sheet_kind: "departure" }, true, now), false);
  assert.equal(isSetAside({ sheet_kind: "vacant", done: true }, true, now), false);
});

test("Today's brief counts rooms left on an earlier day", () => {
  assert.equal(carriedDirtyCount([{ left_dirty_at: yesterday }, { left_dirty_at: today }, { left_dirty_at: yesterday, done: true }], now), 1);
});
