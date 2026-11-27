// Menu → Hotel settings → Modules: turn Calendar, To-dos and Notes on or off
// for the hotel, for departments and for single people (migration 0071).
// Website only: the apps just read which modules each person has.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";
import { listUsers, type AppUserRow } from "@/lib/auth.functions";
import {
  DEPARTMENT_LABEL,
  MODULES,
  MODULE_DEPARTMENTS,
  MODULE_INFO,
  alwaysHasModules,
  moduleSettingsFrom,
  moduleSummary,
  personHasModule,
  type ModuleDepartment,
  type ModuleKey,
  type ModuleSetting,
} from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Modules people can actually open yet. The rest show "Coming soon". */
const READY: ReadonlySet<ModuleKey> = new Set();

const errMsg = (e: unknown, f: string) => (e as { message?: string })?.message ?? f;
const heading = (t: string) => <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}</p>;

function useModuleSettings(hotelId: string | undefined) {
  return useQuery({
    queryKey: ["module_settings", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const [hotel, departments, people] = await Promise.all([
        supabase.from("hotel_modules").select("module, enabled, all_departments").eq("hotel_id", hotelId!),
        supabase.from("module_departments").select("module, department").eq("hotel_id", hotelId!),
        supabase.from("module_people").select("module, user_id, allowed").eq("hotel_id", hotelId!),
      ]);
      const error = hotel.error ?? departments.error ?? people.error;
      if (error) throw error;
      return moduleSettingsFrom({ hotel: hotel.data ?? [], departments: departments.data ?? [], people: people.data ?? [] });
    },
  });
}

export function ModuleSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const hotelId = useCurrentHotel().data?.id;
  const settingsQ = useModuleSettings(open ? hotelId : undefined);
  const listFn = useServerFn(listUsers);
  const staffQ = useQuery({ queryKey: ["app_users"], enabled: open, queryFn: () => listFn() as Promise<AppUserRow[]> });
  const staff = (staffQ.data ?? [])
    .filter((u) => !!hotelId && u.hotelIds.includes(hotelId) && !u.disabled && u.position !== "pending")
    .sort((a, b) => a.username.localeCompare(b.username));
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw error;
    } catch (e) {
      toast.error(errMsg(e, "Couldn't save the module settings."));
    } finally {
      await qc.invalidateQueries({ queryKey: ["module_settings", hotelId] });
      await qc.invalidateQueries({ queryKey: ["my_modules"] });
      setBusy(false);
    }
  };

  const setHotel = (module: ModuleKey, patch: { enabled?: boolean; all_departments?: boolean }) =>
    run(() => supabase.from("hotel_modules").upsert({ hotel_id: hotelId!, module, ...patch }, { onConflict: "hotel_id,module" }));
  const setDepartment = (module: ModuleKey, department: ModuleDepartment, on: boolean) =>
    run(() => on
      ? supabase.from("module_departments").insert({ hotel_id: hotelId!, module, department })
      : supabase.from("module_departments").delete().eq("hotel_id", hotelId!).eq("module", module).eq("department", department));
  const setPerson = (module: ModuleKey, userId: string, allowed: boolean | null) =>
    run(() => allowed === null
      ? supabase.from("module_people").delete().eq("hotel_id", hotelId!).eq("module", module).eq("user_id", userId)
      : supabase.from("module_people").upsert({ hotel_id: hotelId!, module, user_id: userId, allowed }, { onConflict: "hotel_id,module,user_id" }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Modules</SheetTitle>
          <SheetDescription>Extra features this hotel can turn on, for everyone, chosen departments or single people.</SheetDescription>
        </SheetHeader>
        {settingsQ.isError ? (
          <p className="mt-4 text-sm text-destructive">{errMsg(settingsQ.error, "Couldn't load the module settings.")}</p>
        ) : !settingsQ.data ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-4 space-y-4">
            {MODULES.map((m) => (
              <ModuleCard
                key={m}
                module={m}
                setting={settingsQ.data[m]}
                staff={staff}
                staffLoading={staffQ.isLoading}
                busy={busy || !hotelId}
                onHotel={(patch) => void setHotel(m, patch)}
                onDepartment={(d, on) => void setDepartment(m, d, on)}
                onPerson={(id, allowed) => void setPerson(m, id, allowed)}
              />
            ))}
            <p className="text-xs text-muted-foreground">Admins, regional admins and managers always have every module that's on. Turning a module off hides it and its contents; nothing is deleted.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ModuleCard({
  module,
  setting,
  staff,
  staffLoading,
  busy,
  onHotel,
  onDepartment,
  onPerson,
}: {
  module: ModuleKey;
  setting: ModuleSetting;
  staff: AppUserRow[];
  staffLoading: boolean;
  busy: boolean;
  onHotel: (patch: { enabled?: boolean; all_departments?: boolean }) => void;
  onDepartment: (d: ModuleDepartment, on: boolean) => void;
  onPerson: (userId: string, allowed: boolean | null) => void;
}) {
  const info = MODULE_INFO[module];
  const [picking, setPicking] = useState("");
  const has = (u: AppUserRow) => personHasModule(setting, { id: u.id, position: u.position, subRoles: u.subRoles });
  const count = staff.filter(has).length;
  const exceptions = staff.filter((u) => setting.people[u.id] !== undefined);
  const addable = staff.filter((u) => setting.people[u.id] === undefined && !alwaysHasModules(u.position));
  const segment = (active: boolean) => cn(active && "border-primary bg-primary/10 text-primary hover:bg-primary/15");

  return (
    <section className="rounded-xl border p-3 space-y-3" aria-label={info.label}>
      <label className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-medium">
            {info.label}
            {!READY.has(module) && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">Coming soon</span>}
          </span>
          <span className="block text-xs text-muted-foreground">{info.blurb}</span>
          <span className="mt-1 block text-xs font-medium">
            {moduleSummary(setting)}
            {setting.enabled && staff.length > 0 && <span className="font-normal text-muted-foreground"> · {count} of {staff.length} staff</span>}
          </span>
        </span>
        <Switch checked={setting.enabled} disabled={busy} aria-label={`${info.label} at this hotel`} onCheckedChange={(v) => onHotel({ enabled: v })} />
      </label>

      {setting.enabled && (
        <>
          <div className="space-y-2">
            {heading("Who gets it")}
            <div className="grid grid-cols-2 gap-1">
              <Button type="button" size="sm" variant="outline" disabled={busy} aria-pressed={setting.allDepartments}
                className={segment(setting.allDepartments)} onClick={() => onHotel({ all_departments: true })}>Everyone</Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} aria-pressed={!setting.allDepartments}
                className={segment(!setting.allDepartments)} onClick={() => onHotel({ all_departments: false })}>Chosen departments</Button>
            </div>
            {!setting.allDepartments && (
              <div className="divide-y divide-border rounded-xl border">
                {MODULE_DEPARTMENTS.map((d) => (
                  <label key={d} className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
                    {DEPARTMENT_LABEL[d]}
                    <Switch checked={setting.departments.includes(d)} disabled={busy} onCheckedChange={(v) => onDepartment(d, v)} />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {heading("People")}
            {exceptions.length > 0 && (
              <div className="divide-y divide-border rounded-xl border">
                {exceptions.map((u) => {
                  const allowed = setting.people[u.id];
                  return (
                    <div key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{u.username}</span>
                      <div className="grid grid-cols-2 gap-1">
                        <Button type="button" size="sm" variant="outline" disabled={busy} aria-pressed={allowed}
                          className={cn("h-8 px-2", segment(allowed))} onClick={() => onPerson(u.id, true)}>Has it</Button>
                        <Button type="button" size="sm" variant="outline" disabled={busy} aria-pressed={!allowed}
                          className={cn("h-8 px-2", segment(!allowed))} onClick={() => onPerson(u.id, false)}>Doesn't</Button>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={busy}
                        aria-label={`Remove the exception for ${u.username}`} onClick={() => onPerson(u.id, null)}><X className="h-4 w-4" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
            <Select
              value={picking}
              disabled={busy || staffLoading || addable.length === 0}
              onValueChange={(id) => {
                const u = addable.find((x) => x.id === id);
                setPicking("");
                // Start from the opposite of what they'd get now, since that's why they're being added.
                if (u) onPerson(u.id, !has(u));
              }}
            >
              <SelectTrigger aria-label={`Add a person to ${info.label}`}>
                <SelectValue placeholder={staffLoading ? "Loading staff…" : addable.length ? "Add a person…" : "No one else to add"} />
              </SelectTrigger>
              <SelectContent>
                {addable.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.username} · {has(u) ? "has it" : "doesn't have it"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">A person setting beats their department. Use it to give the module to someone outside the chosen departments, or to take it away from one person.</p>
          </div>
        </>
      )}
    </section>
  );
}
