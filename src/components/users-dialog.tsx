import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUsers,
  listHotels,
  createUser,
  createHotel,
  deleteUser,
  updateUserPassword,
  updateUserAssignment,
  setUserDisabled,
  deleteHotel,
  type AppUserRow,
  type HotelOption,
  type Position,
  type SubRole,
} from "@/lib/auth.functions";
import { getStoredUser, refreshSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Check, X, Pencil, Ban, RotateCcw, ChevronDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AssignablePosition = Exclude<Position, "pending">;
const POSITION_LABELS: Record<AssignablePosition, string> = {
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
function positionBadge(p: Position): string {
  return p === "pending" ? "Pending" : POSITION_LABELS[p];
}
function summariseRoles(u: AppUserRow): string {
  const subs = u.subRoles.map((r) => SUB_ROLE_LABELS[r]).join(", ");
  return subs ? `${positionBadge(u.position)} · ${subs}` : positionBadge(u.position);
}

export function UsersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const me = getStoredUser();

  const listFn = useServerFn(listUsers);
  const listHotelsFn = useServerFn(listHotels);
  const createFn = useServerFn(createUser);
  const createHotelFn = useServerFn(createHotel);
  const deleteFn = useServerFn(deleteUser);
  const pwFn = useServerFn(updateUserPassword);
  const assignFn = useServerFn(updateUserAssignment);
  const disableFn = useServerFn(setUserDisabled);
  const deleteHotelFn = useServerFn(deleteHotel);

  const usersQ = useQuery({
    queryKey: ["app_users"],
    enabled: open,
    queryFn: () => listFn() as Promise<AppUserRow[]>,
  });
  const hotelsQ = useQuery({
    queryKey: ["hotels"],
    enabled: open,
    queryFn: () => listHotelsFn() as Promise<HotelOption[]>,
  });

  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPosition, setNewPosition] = useState<AssignablePosition>("user");
  const [newSubRoles, setNewSubRoles] = useState<SubRole[]>(["housekeeper"]);
  const [newHotelIds, setNewHotelIds] = useState<string[]>([]);
  const [newHotelName, setNewHotelName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hotelBusy, setHotelBusy] = useState(false);

  const [pwUser, setPwUser] = useState<AppUserRow | null>(null);
  const [pwValue, setPwValue] = useState("");

  const [editUser, setEditUser] = useState<AppUserRow | null>(null);
  const [editPosition, setEditPosition] = useState<AssignablePosition>("user");
  const [editSubRoles, setEditSubRoles] = useState<SubRole[]>([]);
  const [editHotelIds, setEditHotelIds] = useState<string[]>([]);
  const [editPw, setEditPw] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [disableBusy, setDisableBusy] = useState(false);

  // Sort/filter Accounts by hotel. "" = show every hotel.
  const [accountsFilterHotelId, setAccountsFilterHotelId] = useState<string>("");

  const myPos = me?.position;
  const isSuperAdmin = myPos === "admin";
  const isRegionalManager = myPos === "regional_admin";
  const isManagerOnly = myPos === "manager";
  // Admins and Regional Managers manage across every hotel; Managers only
  // manage users inside their currently active hotel workspace.
  const canManageHotels = isSuperAdmin || isRegionalManager;
  // Kept as the old name because it's referenced in the JSX below.
  const isRegionalAdmin = canManageHotels;
  const assignablePositions: AssignablePosition[] = isSuperAdmin
    ? ["admin", "regional_admin", "manager", "user"]
    : isRegionalManager
    ? ["regional_admin", "manager", "user"]
    : isManagerOnly
    ? ["user"]
    : [];
  // Managers can only add plain Users, so lock the new-user form's position.
  useEffect(() => {
    if (isManagerOnly && newPosition !== "user") setNewPosition("user");
  }, [isManagerOnly, newPosition]);

  useEffect(() => {
    const firstHotelId = hotelsQ.data?.[0]?.id ?? "";
    if (newHotelIds.length === 0 && firstHotelId) setNewHotelIds([firstHotelId]);
  }, [hotelsQ.data, newHotelIds.length]);

  function openEdit(u: AppUserRow) {
    setEditUser(u);
    setEditPosition((u.position === "pending" ? "user" : u.position) as AssignablePosition);
    setEditSubRoles([...u.subRoles]);
    setEditHotelIds(u.hotelIds.length > 0 ? [...u.hotelIds] : hotelsQ.data?.[0]?.id ? [hotelsQ.data[0].id] : []);
    setEditPw("");
  }
  function closeEdit() {
    setEditUser(null);
    setEditPw("");
  }
  function toggleSubRole(list: SubRole[], role: SubRole): SubRole[] {
    return list.includes(role) ? list.filter((r) => r !== role) : [...list, role];
  }
  function toggleHotel(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((h) => h !== id) : [...list, id];
  }
  function sameSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    return b.every((v) => s.has(v));
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser || editBusy) return;
    setEditBusy(true);
    try {
      const assignmentChanged =
        editPosition !== editUser.position ||
        editSubRoles.length !== editUser.subRoles.length ||
        editSubRoles.some((r) => !editUser.subRoles.includes(r)) ||
        !sameSet(editHotelIds, editUser.hotelIds);
      if (assignmentChanged) {
        await assignFn({ data: { id: editUser.id, position: editPosition, subRoles: editSubRoles, hotelIds: editHotelIds } });
      }
      if (editPw.trim().length > 0) {
        await pwFn({ data: { id: editUser.id, password: editPw } });
      }
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["app_users"] });
      qc.invalidateQueries({ queryKey: ["current-hotel"] });
      if (me?.id === editUser.id) {
        void refreshSession();
      }
      closeEdit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setEditBusy(false);
    }
  }

  async function onDeleteFromEdit() {
    if (!editUser) return;
    if (!confirm(`Delete account "${editUser.username}"? This cannot be undone.`)) return;
    try {
      await deleteFn({ data: { id: editUser.id } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["app_users"] });
      closeEdit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function onToggleDisabled() {
    if (!editUser || disableBusy) return;
    const next = !editUser.disabled;
    if (next && !confirm(`Disable "${editUser.username}"? They will be signed out and unable to log in until re-enabled.`)) return;
    setDisableBusy(true);
    try {
      await disableFn({ data: { id: editUser.id, disabled: next } });
      toast.success(next ? "Account disabled" : "Account enabled");
      qc.invalidateQueries({ queryKey: ["app_users"] });
      setEditUser({ ...editUser, disabled: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setDisableBusy(false);
    }
  }

  async function onCreateHotel(e: React.FormEvent) {
    e.preventDefault();
    if (hotelBusy || !newHotelName.trim()) return;
    setHotelBusy(true);
    try {
      const hotel = await createHotelFn({ data: { name: newHotelName } }) as HotelOption;
      toast.success("Hotel created");
      setNewHotelName("");
      setNewHotelIds((prev) => (prev.includes(hotel.id) ? prev : [...prev, hotel.id]));
      qc.invalidateQueries({ queryKey: ["hotels"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create hotel");
    } finally {
      setHotelBusy(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await createFn({
        data: {
          email: newEmail,
          displayName: newDisplayName || undefined,
          password: newPassword,
          position: newPosition,
          subRoles: newSubRoles,
          hotelIds: newHotelIds,
        },
      });
      toast.success("User created");
      setNewEmail("");
      setNewDisplayName("");
      setNewPassword("");
      setNewPosition("user");
      setNewSubRoles(["housekeeper"]);
      qc.invalidateQueries({ queryKey: ["app_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(u: AppUserRow) {
    if (!confirm(`Delete account "${u.username}"? This cannot be undone.`)) return;
    try {
      await deleteFn({ data: { id: u.id } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["app_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function onApprovePending(u: AppUserRow, subRoles: SubRole[]) {
    try {
      await assignFn({ data: { id: u.id, position: "user", subRoles } });
      toast.success("User approved");
      qc.invalidateQueries({ queryKey: ["app_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve user");
    }
  }

  async function onSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwUser) return;
    try {
      await pwFn({ data: { id: pwUser.id, password: pwValue } });
      toast.success("Password updated");
      setPwUser(null);
      setPwValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    }
  }

  const all = usersQ.data ?? [];
  const hotels = hotelsQ.data ?? [];
  const pending = all.filter((u) => u.position === "pending");
  const approved = all.filter((u) => u.position !== "pending");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Users</DialogTitle>
            <DialogDescription>Approve new signups, change roles, reset passwords, or remove accounts.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {pending.length > 0 && (
              <section className="rounded-lg border bg-card">
                <div className="px-4 py-3 border-b text-sm font-semibold">
                  Pending approvals ({pending.length})
                </div>
                <ul className="divide-y">
                  {pending.map((u) => (
                    <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.username}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                       <div className="flex items-center gap-1">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button size="sm" variant="default">
                               <Check className="h-4 w-4 mr-1" />
                               Approve as
                               <ChevronDown className="h-4 w-4 ml-1" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Department</DropdownMenuLabel>
                             <DropdownMenuSeparator />
                             {(["housekeeper", "reception", "fnb", "maintenance"] as SubRole[]).map((r) => (
                               <DropdownMenuItem key={r} onClick={() => onApprovePending(u, [r])}>
                                 {SUB_ROLE_LABELS[r]}
                               </DropdownMenuItem>
                             ))}
                           </DropdownMenuContent>
                         </DropdownMenu>
                         <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(u)}>
                           <X className="h-4 w-4" />
                         </Button>
                       </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Add a user</h2>
              <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Email</label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Display name (optional)</label>
                  <Input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Password</label>
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                {assignablePositions.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Position</label>
                    <select
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value as AssignablePosition)}
                    >
                      {assignablePositions.map((p) => (
                        <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Hotel workspaces</label>
                  {isRegionalAdmin ? (
                    <div className="flex flex-wrap gap-3 rounded-md border bg-background px-3 py-2">
                      {hotels.map((h) => (
                        <label key={h.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newHotelIds.includes(h.id)}
                            onChange={() =>
                              setNewHotelIds((prev) => toggleHotel(prev, h.id))
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
                      New users are added to your active hotel workspace.
                    </p>
                  )}
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Departments</label>
                  <div className="flex flex-wrap gap-3">
                     {(["reception", "housekeeper", "fnb", "maintenance"] as SubRole[]).map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newSubRoles.includes(r)}
                          onChange={() => setNewSubRoles((prev) => toggleSubRole(prev, r))}
                        />
                        {SUB_ROLE_LABELS[r]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={busy} size="sm">
                    {busy ? "Adding…" : "Add user"}
                  </Button>
                </div>
              </form>
            </section>

            {isRegionalAdmin && (
              <section className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Hotel workspaces</h2>
                </div>
                <form onSubmit={onCreateHotel} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newHotelName}
                    onChange={(e) => setNewHotelName(e.target.value)}
                    placeholder="Hotel name"
                    minLength={2}
                    maxLength={80}
                  />
                  <Button type="submit" size="sm" disabled={hotelBusy || !newHotelName.trim()}>
                    {hotelBusy ? "Creating…" : "Create hotel"}
                  </Button>
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hotels.map((h) => (
                    <span
                      key={h.id}
                      className="group inline-flex items-center gap-1 rounded-full border bg-background pl-3 pr-1 py-1 text-xs font-medium"
                    >
                      {h.name}
                      <button
                        type="button"
                        aria-label={`Delete ${h.name}`}
                        onClick={async () => {
                          if (!confirm(`Delete hotel workspace "${h.name}"? This permanently removes all of its rooms, templates, messages, photos and other data. This cannot be undone.`)) return;
                          try {
                            await deleteHotelFn({ data: { hotelId: h.id } });
                            toast.success("Hotel workspace deleted");
                            qc.invalidateQueries({ queryKey: ["hotels"] });
                            qc.invalidateQueries({ queryKey: ["app_users"] });
                            qc.invalidateQueries({ queryKey: ["current-hotel"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to delete hotel");
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-full p-1 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-lg border bg-card">
              <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Accounts</div>
                {hotels.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Building2 className="h-4 w-4 mr-1" />
                        {accountsFilterHotelId
                          ? hotels.find((h) => h.id === accountsFilterHotelId)?.name ?? "Hotel"
                          : "All hotels"}
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Sort by hotel workspace</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setAccountsFilterHotelId("")}>
                        All hotels
                      </DropdownMenuItem>
                      {hotels.map((h) => (
                        <DropdownMenuItem key={h.id} onClick={() => setAccountsFilterHotelId(h.id)}>
                          {h.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {usersQ.isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : (
                <ul className="divide-y">
                  {approved
                    .filter((u) =>
                      accountsFilterHotelId ? u.hotelIds.includes(accountsFilterHotelId) : true,
                    )
                    .map((u) => (
                    <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          <span className="truncate">{u.username}</span>
                          {u.disabled && (
                            <span className="shrink-0 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold uppercase px-2 py-0.5">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {summariseRoles(u)} · {u.hotelNames.length > 0 ? u.hotelNames.join(", ") : "No hotel"}{me && u.id === me.id ? " · you" : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)} title="Edit user">
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </li>
                  ))}
                  {approved.length === 0 && (
                    <li className="p-4 text-sm text-muted-foreground">No approved users yet.</li>
                  )}
                </ul>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwUser} onOpenChange={(o) => { if (!o) { setPwUser(null); setPwValue(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{pwUser?.username}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSavePassword} className="space-y-3">
            <Input
              type="text"
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              placeholder="New password"
              required
              minLength={6}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPwUser(null)}>Cancel</Button>
              <Button type="submit" size="sm">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update role or password for <strong>{editUser?.username}</strong>, disable sign-in, or delete the account.
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <form onSubmit={onSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Position</label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value as AssignablePosition)}
                >
                  {assignablePositions.map((p) => (
                    <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  Email: <span className="text-foreground">{editUser.email}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Hotel workspaces</label>
                {isRegionalAdmin ? (
                  <div className="flex flex-wrap gap-3 rounded-md border bg-background px-3 py-2">
                    {hotels.map((h) => (
                      <label key={h.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editHotelIds.includes(h.id)}
                          onChange={() =>
                            setEditHotelIds((prev) => toggleHotel(prev, h.id))
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
                    {editUser.hotelNames.length > 0
                      ? editUser.hotelNames.join(", ")
                      : "No hotels assigned"}
                    . Only admins and regional managers can change hotel assignments.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Departments</label>
                <div className="flex flex-wrap gap-3">
                   {(["reception", "housekeeper", "fnb", "maintenance"] as SubRole[]).map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editSubRoles.includes(r)}
                        onChange={() => setEditSubRoles((prev) => toggleSubRole(prev, r))}
                      />
                      {SUB_ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
                {editPosition === "user" && editSubRoles.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    A User with no departments has no working view.
                  </p>
                )}
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <div>
                  <div className="text-sm font-medium">Reset password</div>
                  <div className="text-xs text-muted-foreground">
                    Set a new password for this user. Leave blank to keep the current one.
                  </div>
                </div>
                <Input
                  type="text"
                  value={editPw}
                  onChange={(e) => setEditPw(e.target.value)}
                  placeholder="New password (min. 6 characters)"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="rounded-md border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {editUser.disabled ? "Account disabled" : "Account active"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {editUser.disabled
                      ? "User cannot sign in. Their data and role are preserved."
                      : "Disable to block sign-in without deleting the account."}
                  </div>
                </div>
                <Button
                  type="button"
                  variant={editUser.disabled ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleDisabled}
                  disabled={disableBusy || (!!me && editUser.id === me.id)}
                  title={me && editUser.id === me.id ? "You cannot disable yourself" : undefined}
                >
                  {editUser.disabled ? (
                    <><RotateCcw className="h-4 w-4 mr-1" />Enable</>
                  ) : (
                    <><Ban className="h-4 w-4 mr-1" />Disable</>
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onDeleteFromEdit}
                  disabled={!!me && editUser.id === me.id}
                  title={me && editUser.id === me.id ? "You cannot delete yourself" : "Delete user"}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete account
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={closeEdit}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={editBusy}>
                    {editBusy ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}