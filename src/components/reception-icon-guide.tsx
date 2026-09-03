import { Check, Dog, DoorOpen, Footprints, Wrench } from "lucide-react";

type Entry = {
  key: string;
  label: string;
  description: string;
  render: () => React.ReactNode;
};

// Swatches use the exact same tokens as the room tiles so the guide always
// matches what reception sees on the grid.
const TILE_COLOURS: {
  key: string;
  label: string;
  description: string;
  bg: string;
  fg: string;
  border: string;
}[] = [
  {
    key: "todo",
    label: "Not started",
    description: "No status set yet — housekeeping has not begun this room.",
    bg: "var(--room-todo)",
    fg: "var(--room-todo-fg)",
    border: "var(--room-todo-accent)",
  },
  {
    key: "progress",
    label: "Cleaning in Progress",
    description: "A status or linen count exists — housekeeping is working on the room.",
    bg: "var(--room-progress)",
    fg: "var(--room-progress-fg)",
    border: "var(--room-progress-accent)",
  },
  {
    key: "clean",
    label: "Clean",
    description: "Room has been serviced and is clean, but is not an arrival today.",
    bg: "var(--room-cleandone)",
    fg: "var(--room-cleandone-fg)",
    border: "var(--room-cleandone-accent)",
  },
  {
    key: "arrival",
    label: "Arrival",
    description: "Room has been serviced and is ready for an arriving guest.",
    bg: "var(--room-complete)",
    fg: "var(--room-complete-fg)",
    border: "var(--room-complete-accent)",
  },
  {
    key: "stayover",
    label: "Stayover",
    description:
      "Guest is staying another night. Also used for DND and rooms where service was declined.",
    bg: "var(--room-stayover)",
    fg: "var(--room-stayover-fg)",
    border: "var(--room-stayover-accent)",
  },
  {
    key: "stayover-out",
    label: "Stayover — guest out",
    description:
      "Stayover whose guest has left for the day, so the room is empty and can be serviced now.",
    bg: "var(--room-stayover-out)",
    fg: "var(--room-stayover-out-fg)",
    border: "var(--room-stayover-out-accent)",
  },
  {
    key: "dirty",
    label: "ROS - Dirty",
    description: "Room is checked out but has not yet been cleaned.",
    bg: "var(--room-dirty)",
    fg: "var(--room-dirty-fg)",
    border: "var(--room-dirty-accent)",
  },
  {
    key: "early",
    label: "Early check-in",
    description: "Guest is arriving early — this room is a priority for housekeeping.",
    bg: "var(--room-early)",
    fg: "var(--room-early-fg)",
    border: "var(--room-early-accent)",
  },
  {
    key: "late",
    label: "Late Checkout",
    description: "Guest is staying past normal checkout time, so the room cannot be serviced yet.",
    bg: "var(--room-late)",
    fg: "var(--room-late-fg)",
    border: "var(--room-late-accent)",
  },
  {
    key: "staff",
    label: "Staff / ROS",
    description: "Room is out of service or in staff use, and is not serviced today.",
    bg: "var(--room-staff)",
    fg: "var(--room-staff-fg)",
    border: "var(--room-staff-accent)",
  },
];

const ENTRIES: Entry[] = [
  {
    key: "big-tick",
    label: "Large tick across the tile",
    description:
      "Housekeeping has pressed “Mark as Done” for this room. It only appears for rooms that are actually serviced — never for DND, service declined, Dirty, ROS or Staff rooms.",
    render: () => <Check strokeWidth={2} className="h-6 w-6 opacity-40" />,
  },
  {
    key: "status-bed",
    label: "STATUS - LETTER",
    description:
      "The caption on each tile shows the room status followed by the bed short code: D double, K king, T twin.",
    render: () => (
      <span className="text-[10px] font-bold leading-none tracking-tight">A - K</span>
    ),
  },
  {
    key: "dnd",
    label: "DND",
    description:
      "Do Not Disturb sign on the door. The room is treated as a stayover, is marked done and is left out of the housekeeping progress total. The door photo is kept in Settings → Stayover Photos.",
    render: () => (
      <span className="text-xs font-bold leading-none tracking-wide">DND</span>
    ),
  },
  {
    key: "not-required",
    label: "NR",
    description:
      "Not Required — the guest has declined room service today. The room is treated as a stayover and marked done.",
    render: () => (
      <span className="text-[10px] font-bold leading-none tracking-wide">NR</span>
    ),
  },
  {
    key: "amber-dot",
    label: "Orange dot",
    description:
      "Housekeeping has left a note or message on this room. Open the room panel to read it.",
    render: () => (
      <span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-background" />
    ),
  },
  {
    key: "door",
    label: "Door icon",
    description: "Guest has checked out — the room is ready for turnover once cleaned.",
    render: () => (
      <DoorOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
    ),
  },
  {
    key: "footprints",
    label: "Footprints icon",
    description:
      "Stayover — guest out for the day. The room is empty and can be serviced. It disappears once housekeeping marks the room done.",
    render: () => (
      <Footprints className="h-5 w-5 text-sky-600 dark:text-sky-400" />
    ),
  },
  {
    key: "dog",
    label: "Dog badge",
    description: "Reception has flagged that this room needs a dog box.",
    render: () => (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-[8px] font-bold leading-none tracking-wide text-white dark:bg-violet-500 dark:text-violet-950">
        <Dog aria-hidden className="h-2.5 w-2.5" />
        Dog
      </span>
    ),
  },
  {
    key: "wrench",
    label: "Wrench",
    description:
      "This room has been flagged as needing maintenance. Open the room to read the note or see the linked request in the Maintenance log.",
    render: () => <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  },
];

export function ReceptionIconGuide() {
  return (
    <div className="mt-2 space-y-4">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Tile colours
        </p>
        <ul className="divide-y rounded-xl border bg-card">
          {TILE_COLOURS.map((c) => (
            <li key={c.key} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-6 w-10 items-center justify-center shrink-0 rounded-xl border"
                  style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
                />
                <span className="text-sm font-medium flex-1">{c.label}</span>
              </div>
              <p className="mt-1 pl-[3.25rem] text-xs text-muted-foreground">
                {c.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Icons &amp; symbols
        </p>
        <ul className="divide-y rounded-xl border bg-card">
          {ENTRIES.map((e) => (
            <li key={e.key} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center shrink-0">
                  {e.render()}
                </span>
                <span className="text-sm font-medium flex-1">{e.label}</span>
              </div>
              <p className="mt-1 pl-11 text-xs text-muted-foreground">
                {e.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
