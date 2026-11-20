// Home's list view and the grid/list switch (HomeList.swift / HomeListView.kt):
// "To do" with the room cards, then "Done · n rooms" to show the rest.
import { useState, type ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import { playClick } from "@/lib/click-sound";
import type { HomeLayout } from "@/lib/home-list";

/**
 * Grid or list: one button beside Reset all and Quick Room Setup (HomeLayoutButton in
 * HomeList.swift). It shows the view it switches to. `children` draws it in the
 * header's own button style.
 */
export function HomeLayoutButton({ layout, onChange, render }: {
  layout: HomeLayout;
  onChange: (layout: HomeLayout) => void;
  render: (props: { icon: ReactNode; label: string; onClick: () => void }) => ReactNode;
}) {
  const next: HomeLayout = layout === "grid" ? "list" : "grid";
  return <>{render({
    icon: next === "list" ? <List aria-hidden className="h-4 w-4" /> : <LayoutGrid aria-hidden className="h-4 w-4" />,
    label: next === "list" ? "List view" : "Grid view",
    onClick: () => { playClick(); onChange(next); },
  })}</>;
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
