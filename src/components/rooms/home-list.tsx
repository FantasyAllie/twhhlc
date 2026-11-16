// Home's list view and the grid/list switch (HomeList.swift / HomeListView.kt):
// "To do" with the room cards, then "Done · n rooms" to show the rest.
import { useState, type ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { playClick } from "@/lib/click-sound";
import type { HomeLayout } from "@/lib/home-list";

export function HomeLayoutToggle({ layout, onChange }: { layout: HomeLayout; onChange: (layout: HomeLayout) => void }) {
  const option = (value: HomeLayout, label: string, icon: ReactNode) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={layout === value}
      onClick={() => { playClick(); onChange(value); }}
      className={cn(
        "flex h-8 w-10 items-center justify-center rounded-full transition-colors",
        layout === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
  return (
    <div role="group" aria-label="View" className="flex shrink-0 items-center rounded-full border border-border bg-background p-1">
      {option("grid", "Grid view", <LayoutGrid aria-hidden className="h-4 w-4" />)}
      {option("list", "List view", <List aria-hidden className="h-4 w-4" />)}
    </div>
  );
}

export function HomeList({ toDo, finished }: { toDo: { n: number; card: ReactNode }[]; finished: { n: number; card: ReactNode }[] }) {
  const [showDone, setShowDone] = useState(false);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2">
      <p className="pl-1 text-xs font-semibold tracking-wider text-muted-foreground">TO DO · {toDo.length}</p>
      {toDo.length === 0 && <p className="p-1 text-sm text-muted-foreground">Every room is done.</p>}
      {toDo.map((r) => <div key={r.n}>{r.card}</div>)}
      {finished.length > 0 && (
        <button
          type="button"
          onClick={() => { playClick(); setShowDone((v) => !v); }}
          aria-expanded={showDone}
          className="flex min-h-12 items-center justify-between rounded-xl px-3.5 text-sm font-semibold hover:bg-accent/40"
        >
          <span>Done · {finished.length} rooms</span>
          <span className="font-normal text-muted-foreground">{showDone ? "Hide" : "Show"}</span>
        </button>
      )}
      {showDone && finished.map((r) => <div key={r.n}>{r.card}</div>)}
    </div>
  );
}
