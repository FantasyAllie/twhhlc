import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUsers,
  createUser,
  deleteUser,
  updateUserPassword,
  updateUserAssignment,
  setUserDisabled,
  type AppUserRow,
  type Position,
  type SubRole,
} from "@/lib/auth.functions";
import { getStoredUser } from "@/lib/auth-client";
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
import { Trash2, Check, X, Pencil, Ban, RotateCcw } from "lucide-react";

type AssignablePosition = Exclude<Position, "pending">;
const POSITION_LABELS: Record<AssignablePosition, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "User",
};
const SUB_ROLE_LABELS: Record<SubRole, string> = {
  reception: "Reception",
  housekeeper: "Housekeeper",
  fnb: "F&B",
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
  const createFn = useServerFn(createUser);
  const deleteFn = useServerFn(deleteUser);
  const pwFn = useServerFn(updateUserPassword);
  const assignFn = useServerFn(updateUserAssignment);
  const disableFn = useServerFn(setUserDisabled);

  const usersQ = useQuery({
    queryKey: ["app_users"],
    enabled: open,
    queryFn: () => listFn() as Promise<AppUserRow[]>,
  });

  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPosition, setNewPosition] = useState<AssignablePosition>("user");
  const [newSubRoles, setNewSubRoles] = useState<SubRole[]>(["housekeeper"]);
  const [busy, setBusy] = useState(false);

  const [pwUser, setPwUser] = useState<AppUserRow | null>(null);
  const [pwValue, setPwValue] = useState("");

  const [editUser, setEditUser] = useState<AppUserRow | null>(null);
  const [editPosition, setEditPosition] = useState<AssignablePosition>("user");
  const [editSubRoles, setEditSubRoles] = useState<SubRole[]>([]);
  const [editPw, setEditPw] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [disableBusy, setDisableBusy] = useState(false);

  function openEdit(u: AppUserRow) {
    setEditUser(u);
    setEditPosition((u.position === "pending" ? "user" : u.position) as AssignablePosition);
    setEditSubRoles([...u.subRoles]);
    setEditPw("");
  }
  function closeEdit() {
    setEditUser(null);
    setEditPw("");
  }
  function toggleSubRole(list: SubRole[], role: SubRole): SubRole[] {
    return list.includes(role) ? list.filter((r) => r !== role) : [...list, role];
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser || editBusy) return;
    setEditBusy(true);
    try {
      const rolesChanged =
        editPosition !== editUser.position ||
        editSubRoles.length !== editUser.subRoles.length ||
        editSubRoles.some((r) => !editUser.subRoles.includes(r));
      if (rolesChanged) {
        await assignFn({ data: { id: editUser.id, position: editPosition, subRoles: editSubRoles } });
      }
      if (editPw.trim().length > 0) {
        await pwFn({ data: { id: editUser.id, password: editPw } });
      }
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["app_users"] });
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
                        <Button size="sm" variant="default" onClick={() => onApprovePending(u, ["housekeeper"]) }>
                          <Check className="h-4 w-4 mr-1" />Approve as housekeeper
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onApprovePending(u, ["reception"]) }>
                          Reception
                        </Button>
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
                <div className="space-y-1">
                  <label className="text-xs font-medium">Position</label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value as AssignablePosition)}
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Sub-roles</label>
                  <div className="flex flex-wrap gap-3">
                    {(["reception", "housekeeper", "fnb"] as SubRole[]).map((r) => (
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

            <section className="rounded-lg border bg-card">
              <div className="px-4 py-3 border-b text-sm font-semibold">Approved users</div>
              {usersQ.isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : (
                <ul className="divide-y">
                  {approved.map((u) => (
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
                          {summariseRoles(u)} · {u.email}{me && u.id === me.id ? " · you" : ""}
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
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Sub-roles</label>
                <div className="flex flex-wrap gap-3">
                  {(["reception", "housekeeper", "fnb"] as SubRole[]).map((r) => (
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
                    A User with no sub-roles has no working view.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">New password (optional)</label>
                <Input
                  type="text"
                  value={editPw}
                  onChange={(e) => setEditPw(e.target.value)}
                  placeholder="Leave blank to keep current"
                  minLength={6}
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