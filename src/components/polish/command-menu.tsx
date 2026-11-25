import { useEffect } from "react";
import { BedDouble } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { commandShortcut } from "@/lib/polish";
import type { DeskMenuGroup, DeskMenuItem } from "@/components/desktop/desk-sidebar";

export type CommandRoom = { number: number; detail: string };


/**
 * Polish preview: the command menu. Rooms by number, then every item the menu
 * already offers this person (same list, so nobody sees more than today).
 */
export function CommandMenu({
  open,
  onOpenChange,
  rooms,
  groups,
  onOpenRoom,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: CommandRoom[];
  groups: DeskMenuGroup[];
  onOpenRoom: (n: number) => void;
  onPick: (item: DeskMenuItem) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    // Let the menu close first, so whatever opens next takes the focus.
    requestAnimationFrame(fn);
  };
  const text = (item: DeskMenuItem) => (typeof item.label === "string" ? item.label : item.key.replace(/-/g, " "));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>("[cmdk-input]")?.focus();
          }}
          className="fixed left-1/2 top-[14vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Find a room or page</DialogPrimitive.Title>
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2">
      <CommandInput placeholder="Type a room number or what you want to do…" />
      <CommandList className="max-h-[min(24rem,60vh)]">
        <CommandEmpty>Nothing matches.</CommandEmpty>
        {rooms.length > 0 && (
          <CommandGroup heading="Rooms">
            {rooms.map((r) => (
              <CommandItem
                key={r.number}
                value={`room ${r.number} ${r.detail}`}
                onSelect={() => run(() => onOpenRoom(r.number))}
              >
                <BedDouble />
                <span className="font-semibold tabular-nums">Room {r.number}</span>
                <span className="ml-2 truncate text-muted-foreground">{r.detail}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.map((g) => (
          <CommandGroup key={g.id} heading={g.title}>
            {g.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.key}
                  value={`${text(item)} ${g.title}`}
                  onSelect={() => run(() => onPick(item))}
                  className={item.destructive ? "text-destructive" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>↑↓ move · Enter open · Esc close · On the room grid: arrow keys, Enter, Esc, and / to search</span>
        <CommandShortcut className="ml-0">{commandShortcut()}</CommandShortcut>
      </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
