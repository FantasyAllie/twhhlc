import { useState } from "react";
import { Bed, Wrench, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type Entry = {
  key: string;
  label: string;
  description: string;
  render: () => React.ReactNode;
};

const ENTRIES: Entry[] = [
  {
    key: "bed",
    label: "Bed icon",
    description:
      "The room is clean and ready, but no bed type has been selected yet. Open the room to set the bed configuration.",
    render: () => <Bed className="h-5 w-5" />,
  },
  {
    key: "wrench",
    label: "Wrench",
    description:
      "Housekeeping has flagged this room as needing maintenance. Open the room to read the maintenance note.",
    render: () => <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  },
  {
    key: "dnd",
    label: "DND",
    description:
      "Room is a stayover and the guest has a Do Not Disturb sign on the door. Do not enter.",
    render: () => (
      <span className="text-xs font-bold leading-none tracking-wide">DND</span>
    ),
  },
  {
    key: "dot",
    label: "Orange dot",
    description:
      "There is an unread message or notification about this room from housekeeping.",
    render: () => (
      <span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-background" />
    ),
  },
  {
    key: "out",
    label: "OUT badge",
    description:
      "Housekeeping has marked the guest as vacated. The room is ready for turnover once cleaned.",
    render: () => (
      <span className="rounded-sm bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide text-white dark:bg-emerald-500 dark:text-emerald-950">
        OUT
      </span>
    ),
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
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <ul className="mt-2 divide-y rounded-md border bg-card">
      {ENTRIES.map((e) => {
        const open = openKey === e.key;
        return (
          <li key={e.key}>
            <button
              type="button"
              onClick={() => setOpenKey(open ? null : e.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors",
                open && "bg-accent",
              )}
              aria-expanded={open}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center shrink-0">
                {e.render()}
              </span>
              <span className="text-sm font-medium flex-1">{e.label}</span>
            </button>
            {open && (
              <p className="px-3 pb-3 -mt-1 text-xs text-muted-foreground">
                {e.description}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
