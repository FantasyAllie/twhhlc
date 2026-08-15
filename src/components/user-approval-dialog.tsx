import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPendingUsers,
  approvePendingUser,
  listHotels,
  type PendingUserRow,
  type HotelOption,
  type Position,
  type SubRole,
} from "@/lib/auth.functions";
import { getStoredUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check } from "lucide-react";

type AssignablePosition = Exclude<Position, "pending">;
const POSITION_LABELS: Record<AssignablePosition, string> = {
  developer: "Developer",
  regional_admin: "Regional Manager",
  admin: "Admin",
  manager: "Manager",
  user: "User",
};
const SUB_ROLE_LABELS: Record<SubRole, string> = {
  reception: "Reception",
  housekeeper: "Housekeeping",
  fnb: "F&B",
  maintenance: "Maintenance",
};

export function UserApprovalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const me = getStoredUser();
  const listFn = useServerFn(listPendingUsers);
  const approveFn = useServerFn(approvePendingUser);
  const listHotelsFn = useServerFn(listHotels);

  const pendingQ = useQuery({
    queryKey: ["pending_users"],
    enabled: open,
    queryFn: () => listFn() as Promise<PendingUserRow[]>,
  });
  const hotelsQ = useQuery({
    queryKey: ["hotels"],
    enabled: open,
    queryFn: () => listHotelsFn() as Promise<HotelOption[]>,
  });

  const myPos = me?.position;
  const isDeveloper = myPos === "developer";
  const isSuperAdmin = myPos === "admin" || isDeveloper;
  const isRegionalManager = myPos === "regional_admin";
  const canPickAnyHotel = isSuperAdmin || isRegionalManager;
  // Sub-roles the current approver has themselves. Managers can only assign
  // departments they are members of; admins/regional/developers see all.
  const mySubs: SubRole[] = me?.subRoles ?? [];
  const availableSubs: SubRole[] = isSuperAdmin || isRegionalManager
    ? (["reception", "housekeeper", "fnb", "maintenance"] as SubRole[])
    : mySubs;
  const assignablePositions: AssignablePosition[] = isDeveloper
    ? ["developer", "admin", "regional_admin", "manager", "user"]
    : isSuperAdmin
    ? ["admin", "regional_admin", "manager", "user"]
    : isRegionalManager
    ? ["regional_admin", "manager", "user"]
    : ["user"];

  const [selected, setSelected] = useState<PendingUserRow | null>(null);
  const [position, setPosition] = useState<AssignablePosition>("user");
  const [subRoles, setSubRoles] = useState<SubRole[]>([]);
  const [hotelIds, setHotelIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected) return;
    // Seed defaults when opening the sub-form for a specific user.
    setPosition(assignablePositions[assignablePositions.length - 1]);
    setSubRoles(availableSubs.length === 1 ? [availableSubs[0]] : []);
    if (canPickAnyHotel) setHotelIds([]);
    else setHotelIds([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function onApprove() {
    if (!selected || busy) return;
    if (subRoles.length === 0) {
      toast.error("Pick at least one department");
      return;
    }
    if (canPickAnyHotel && hotelIds.length === 0) {
      toast.error("Assign at least one hotel");
      return;
    }
    setBusy(true);
    try {
      await approveFn({
        data: {
          id: selected.id,
          position,
          subRoles,
          hotelIds: canPickAnyHotel ? hotelIds : undefined,
        },
      });
      toast.success(`Approved ${selected.username}`);
      qc.invalidateQueries({ queryKey: ["pending_users"] });
      qc.invalidateQueries({ queryKey: ["app_users"] });
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve user");
    } finally {
      setBusy(false);
    }
  }

  const pending = pendingQ.data ?? [];
  const hotels = hotelsQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] sm:w-full max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>User Approval</DialogTitle>
          <DialogDescription>
            Approve new signups by assigning them a position, department and hotel.
          </DialogDescription>
        </DialogHeader>
        <section className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b text-sm font-semibold">
            Pending approvals ({pending.length})
          </div>
          {pendingQ.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No pending accounts.</div>
          ) : (
            <ul className="divide-y">
              {pending.map((u) => (
                <li key={u.id} className="px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.username}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={selected?.id === u.id ? "outline" : "default"}
                      onClick={() => setSelected(selected?.id === u.id ? null : u)}
                    >
                      {selected?.id === u.id ? "Cancel" : "Approve"}
                    </Button>
                  </div>
                  {selected?.id === u.id && (
                    <div className="rounded-xl border bg-background p-3 space-y-3">
                      {assignablePositions.length > 1 && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Position</label>
                          <select
                            className="w-full h-9 rounded-xl border bg-background px-3 text-sm"
                            value={position}
                            onChange={(e) => setPosition(e.target.value as AssignablePosition)}
                          >
                            {assignablePositions.map((p) => (
                              <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Departments</label>
                        <div className="flex flex-wrap gap-3">
                          {availableSubs.map((r) => (
                            <label key={r} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={subRoles.includes(r)}
                                onChange={() =>
                                  setSubRoles((prev) =>
                                    prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
                                  )
                                }
                              />
                              {SUB_ROLE_LABELS[r]}
                            </label>
                          ))}
                          {availableSubs.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              You have no departments assigned, so you cannot approve users.
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Hotel workspace</label>
                        {canPickAnyHotel ? (
                          <div className="flex flex-wrap gap-3 rounded-xl border bg-background px-3 py-2">
                            {hotels.map((h) => (
                              <label key={h.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={hotelIds.includes(h.id)}
                                  onChange={() =>
                                    setHotelIds((prev) =>
                                      prev.includes(h.id) ? prev.filter((x) => x !== h.id) : [...prev, h.id],
                                    )
                                  }
                                />
                                {h.name}
                              </label>
                            ))}
                            {hotels.length === 0 && (
                              <span className="text-xs text-muted-foreground">No hotels yet.</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            User will be added to your active hotel workspace.
                          </p>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" disabled={busy || availableSubs.length === 0} onClick={onApprove}>
                          <Check className="h-4 w-4 mr-1" />
                          {busy ? "Approving…" : "Confirm approval"}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}