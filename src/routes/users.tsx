import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUsers,
  createUser,
  deleteUser,
  updateUserPassword,
  updateUserRole,
  setUserDisabled,
  type AppUserRow,
  type ApprovedRole,
} from "@/lib/auth.functions";
import { getStoredUser, clearSession, type SessionUser } from "@/lib/auth-client";
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
import { ArrowLeft, Trash2, Check, X, Pencil, Ban, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/users")({
  ssr: false,
  head: () => ({ meta: [{ title: "Users — TW Linen Counter" }] }),
  component: UsersPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-sm">
      <p className="mb-3">{error.message}</p>
      <Button size="sm" onClick={reset}>Retry</Button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Page not found</div>,
});

function UsersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const deleteFn = useServerFn(deleteUser);
  const pwFn = useServerFn(updateUserPassword);
  const roleFn = useServerFn(updateUserRole);
  const disableFn = useServerFn(setUserDisabled);

  useEffect(() => {
    const tick = () => {
      const u = getStoredUser();
      if (!u) {
        // still loading? wait one more frame, then redirect
        setTimeout(() => {
          const u2 = getStoredUser();
          if (!u2) navigate({ to: "/login", replace: true });
          else if (u2.role !== "admin") navigate({ to: "/app", replace: true });
          else { setMe(u2); setReady(true); }
        }, 100);
        return;
      }
      if (u.role !== "admin") {
        navigate({ to: "/app", replace: true });
        return;
      }
      setMe(u);
      setReady(true);
    };
    tick();
    const onChange = () => tick();
    window.addEventListener("tw-auth-changed", onChange);
    return () => window.removeEventListener("tw-auth-changed", onChange);
  }, [navigate]);

  const usersQ = useQuery({
    queryKey: ["app_users"],
    enabled: ready,
    queryFn: () => listFn() as Promise<AppUserRow[]>,
  });

  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<ApprovedRole>("user");
  const [busy, setBusy] = useState(false);

  const [pwUser, setPwUser] = useState<AppUserRow | null>(null);
  const [pwValue, setPwValue] = useState("");

  const [editUser, setEditUser] = useState<AppUserRow | null>(null);
  const [editRole, setEditRole] = useState<ApprovedRole>("user");
  const [editPw, setEditPw] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [disableBusy, setDisableBusy] = useState(false);

  function openEdit(u: AppUserRow) {
    setEditUser(u);
    setEditRole((u.role === "pending" ? "user" : u.role) as ApprovedRole);
    setEditPw("");
  }
  function closeEdit() {
    setEditUser(null);
    setEditPw("");
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser || editBusy) return;
    setEditBusy(true);
    try {
      if (editRole !== editUser.role) {
        await roleFn({ data: { id: editUser.id, role: editRole } });
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
      await createFn({ data: { email: newEmail, displayName: newDisplayName || undefined, password: newPassword, role: newRole } });
      toast.success("User created");
      setNewEmail("");
      setNewDisplayName("");
      setNewPassword("");
      setNewRole("user");
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

  async function onSetRole(u: AppUserRow, next: ApprovedRole) {
    try {
      await roleFn({ data: { id: u.id, role: next } });
      toast.success(`Role updated to ${next}`);
      qc.invalidateQueries({ queryKey: ["app_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
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

  async function signOut() {
    await clearSession();
    navigate({ to: "/login", replace: true });
  }

  if (!ready || !me) return null;

  const all = usersQ.data ?? [];
  const pending = all.filter((u) => u.role === "pending");
  const approved = all.filter((u) => u.role !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
            </Button>
            <h1 className="text-lg font-semibold">Users</h1>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
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
                    <Button size="sm" onClick={() => onSetRole(u, "user")}>
                      <Check className="h-4 w-4 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onSetRole(u, "reception")}>
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
              <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
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
              <label className="text-xs font-medium">Role</label>
              <select
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as ApprovedRole)}
              >
                <option value="user">User</option>
                <option value="reception">Reception</option>
                <option value="fnb">F&amp;B</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
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
                    <div className="text-xs text-muted-foreground capitalize truncate">{u.role} · {u.email}{u.id === me.id ? " · you" : ""}</div>
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
      </main>

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
                <label className="text-xs font-medium">Role</label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as ApprovedRole)}
                >
                  <option value="user">User</option>
                  <option value="reception">Reception</option>
                  <option value="fnb">F&amp;B</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
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
                  disabled={disableBusy || editUser.id === me.id}
                  title={editUser.id === me.id ? "You cannot disable yourself" : undefined}
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
                  disabled={editUser.id === me.id}
                  title={editUser.id === me.id ? "You cannot delete yourself" : "Delete user"}
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
    </div>
  );
}