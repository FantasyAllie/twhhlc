import { Wrench, Bell, MessageSquare, DoorOpen, Camera } from "lucide-react";

type Entry = {
  key: string;
  label: string;
  description: string;
  render: () => React.ReactNode;
};

const TILE_COLOURS: {
  key: string;
  label: string;
  description: string;
  swatch: string;
  text?: string;
}[] = [
  {
    key: "red",
    label: "Red",
    description: "Room has not been serviced yet by housekeeping.",
    swatch: "bg-rose-500",
  },
  {
    key: "green",
    label: "Green",
    description:
      "Room has been serviced and is ready for an arrival.",
    swatch: "bg-emerald-500",
  },
  {
    key: "blue",
    label: "Blue",
    description:
      "Stayover — the guest is staying another night. The room has been serviced (or is set to be) but is not turning over.",
    swatch: "bg-sky-500",
  },
  {
    key: "purple",
    label: "Purple",
    description:
      "Room has been serviced but is not an arrival today (e.g. clean & vacant, or held for later use).",
    swatch: "bg-violet-500",
  },
  {
    key: "brown",
    label: "Brown",
    description:
      "Dirty — the room is checked out but has not yet been cleaned.",
    swatch: "bg-amber-800",
  },
  {
    key: "slate",
    label: "Grey",
    description:
      "Room is out of service, staff use, or a status has not been set.",
    swatch: "bg-slate-400",
  },
];

const ENTRIES: Entry[] = [
  {
    key: "wrench",
    label: "Wrench",
    description:
      "Housekeeping (or Reception) has flagged this room as needing maintenance. Open the room to read the maintenance note or see the linked request in the Maintenance log.",
    render: () => <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  },
  {
    key: "dnd",
    label: "DND",
    description:
      "Stayover with a Do Not Disturb sign on the door. Do not enter. The DND door photo taken by housekeeping is shown inside the room panel and in Settings → Stayover Photos.",
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
      "There is an active message, maintenance request or lost-property item associated with this room. Open the room panel to see the details.",
    render: () => (
      <span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-background" />
    ),
  },
  {
    key: "primary-dot",
    label: "Blue dot",
    description:
      "Housekeeping has left a note for reception on this room. Open the room to read and confirm it.",
    render: () => (
      <span className="h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
    ),
  },
  {
    key: "door",
    label: "Door icon",
    description:
      "Guest has checked out — the room is ready for turnover once cleaned. Also used for early check-in.",
    render: () => (
      <DoorOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
    ),
  },
  {
    key: "message",
    label: "Message icon",
    description:
      "Opens the room's notification panel. Use it to send messages to housekeeping or view replies from them.",
    render: () => <MessageSquare className="h-5 w-5" />,
  },
  {
    key: "camera",
    label: "Camera / photo",
    description:
      "Attach a photo to a lost-property or maintenance entry, or view the DND door photo taken today.",
    render: () => <Camera className="h-5 w-5" />,
  },
  {
    key: "bell",
    label: "Bell",
    description:
      "Opens the notifications panel, showing recent messages and updates from housekeeping.",
    render: () => <Bell className="h-5 w-5" />,
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
                  className={`inline-flex h-6 w-10 items-center justify-center shrink-0 rounded-xl border ${c.swatch}`}
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
