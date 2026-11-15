// How each leaderboard category is ranked. Most categories go highest first.
// "Fewest rooms marked dirty" is the other way round: everyone who marked a room
// clean that month takes part (so 0 dirty is possible and best), and ties go to
// whoever marked more rooms clean. The iPhone and Android apps use the same rule.

export type Tally = Record<string, Map<string, number>>;

/** The category whose winner marked the fewest rooms dirty. */
export const FEWEST_DIRTY = "room_dirty";

export function rankCategory(key: string, tally: Tally): [string, number][] {
  if (key !== FEWEST_DIRTY) {
    return [...(tally[key] ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  }
  const clean = tally["room_clean"] ?? new Map<string, number>();
  const dirty = tally[key] ?? new Map<string, number>();
  return [...clean.entries()]
    .map(([name, cleaned]) => ({ name, cleaned, dirty: dirty.get(name) ?? 0 }))
    .sort((a, b) => a.dirty - b.dirty || b.cleaned - a.cleaned || a.name.localeCompare(b.name))
    .map((r) => [r.name, r.dirty] as [string, number]);
}
