// The new desktop layout's sidebar (DESKTOP-layout-spec.md). It shows the same
// menu sections the More menu builds (who sees what is decided there, not here),
// opening each item the same way the menu does. Account and appearance items go
// in the chip at the bottom.
import * as React from "react";
import { ChevronUp, House, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NamedAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DeskMenuItem = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  notify?: boolean;
};
export type DeskMenuGroup = { id: string; title: string; items: DeskMenuItem[] };
/** One of Home's filters, listed as a View. */
export type DeskView = { key: string; label: string; count: number; active: boolean; onSelect: () => void };
/** One line in the Live box. */
export type DeskLiveLine = { id: string; title: string; detail: string; time: string; dotClass: string; onOpen: () => void };

/** Groups shown in the chip at the bottom rather than down the sidebar. */
const CHIP_GROUPS = new Set(["account", "appearance"]);
/** Hotel settings: one sidebar row opening the Settings page (its sections run along the top). */
export const SETTINGS_GROUP = "settings";

export function DeskSidebar({
  hotelName,
  department,
  userName,
  groups,
  homeActive,
  activeKey,
  onHome,
  onPick,
  keepsMenuOpen,
  live = [],
  views = [],
}: {
  hotelName: string;
  department: string | null;
  userName: string | null;
  groups: DeskMenuGroup[];
  homeActive: boolean;
  /** The item whose page is open, if any. */
  activeKey: string | null;
  onHome: () => void;
  onPick: (item: DeskMenuItem) => void;
  /** Items that act without leaving the menu (theme, accent, the layout switch). */
  keepsMenuOpen: (key: string) => boolean;
  /** The newest messages, faults and lost property, read-only; each opens its page. */
  live?: DeskLiveLine[];
  /** Home's filters as one-click views; empty for departments without them. */
  views?: DeskView[];
}) {
  const listed = groups.filter((g) => !CHIP_GROUPS.has(g.id) && g.items.length > 0);
  const chip = groups.filter((g) => CHIP_GROUPS.has(g.id) && g.items.length > 0);
  const row = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
        : "text-sidebar-foreground hover:bg-sidebar-accent",
    );
  return (
    <aside
      data-desk-sidebar
      aria-label="Menu"
      className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className="shrink-0 px-4 pt-5 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sidebar-primary">Tsuyu</p>
        <p className="mt-1 truncate text-base font-semibold">{hotelName}</p>
        {department && <p className="text-xs text-sidebar-foreground/60">{department}</p>}
      </div>
      <nav className="flex-1 min-h-0 space-y-4 overflow-y-auto px-2.5 pb-3">
        <button type="button" onClick={onHome} aria-current={homeActive ? "page" : undefined} className={row(homeActive)}>
          <House className="h-4 w-4 shrink-0" />
          Home
        </button>
        {views.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/60">Views</p>
            {views.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={v.onSelect}
                aria-pressed={v.active}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  v.active ? "bg-sidebar-accent font-semibold" : "hover:bg-sidebar-accent",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{v.label}</span>
                <span className="text-xs tabular-nums text-sidebar-foreground/60">{v.count}</span>
              </button>
            ))}
          </div>
        )}
        {listed.map((group) => group.id === SETTINGS_GROUP ? (
          <div key={group.id} className="space-y-0.5">
            {(() => {
              const active = group.items.some((i) => i.key === activeKey);
              return (
                <button type="button" onClick={() => onPick(group.items[0])} aria-current={active ? "page" : undefined} className={row(active)}>
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{group.title}</span>
                </button>
              );
            })()}
          </div>
        ) : (
          <div key={group.id} className="space-y-0.5">
            <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/60">{group.title}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onPick(item)}
                  aria-current={active ? "page" : undefined}
                  className={cn(row(active), item.destructive && !active && "text-destructive")}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", item.notify && !active && "text-amber-500")} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
        {live.length > 0 && (
          <section aria-label="Live" className="space-y-0.5 rounded-xl border border-sidebar-border bg-background/60 p-2">
            <p className="flex items-center gap-1.5 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/60">
              Live <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            </p>
            {live.map((l) => (
              <button key={l.id} type="button" onClick={l.onOpen} className="flex w-full gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-sidebar-accent">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", l.dotClass)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{l.title}</span>
                  <span className="block truncate text-xs text-sidebar-foreground/60">{l.time} · {l.detail}</span>
                </span>
              </button>
            ))}
          </section>
        )}
      </nav>
      {chip.length > 0 && (
        <div className="shrink-0 border-t border-sidebar-border p-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-sidebar-accent">
                {userName && <NamedAvatar name={userName} className="h-8 w-8 shrink-0 text-sm" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{userName ?? "Account"}</span>
                  <span className="block truncate text-xs text-sidebar-foreground/60">Account, hotel and theme</span>
                </span>
                <ChevronUp className="h-4 w-4 shrink-0 text-sidebar-foreground/60" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-60">
              {chip.map((group, gi) => (
                <React.Fragment key={group.id}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </DropdownMenuLabel>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.key}
                        onSelect={(e) => {
                          if (keepsMenuOpen(item.key)) e.preventDefault();
                          onPick(item);
                        }}
                        className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span className="flex-1">{item.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}
