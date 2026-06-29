import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUsers,
  createUser,
  deleteUser,
  updateUserPassword,
  updateUserRole,
  type AppUserRow,
} from "@/lib/auth.functions";
import { getToken, getStoredUser } from "@/lib/auth-client";
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
import { Trash2, KeyRound } from "lucide-react";

export function UsersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const token = getToken();
  const me = getStoredUser();

  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const deleteFn = useServerFn(deleteUser);
  const pwFn = useServerFn(updateUserPassword);
  const roleFn = useServerFn(updateUserRole);

  const usersQ = useQuery({
    queryKey: ["app_users"],
    enabled: !!token && open,
    queryFn: () => listFn({ data: { token: token! } }) as Promise<AppUserRow[]>,
  });

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user" | "reception">("user");
  const [busy, setBusy] = useState(false);

  const [pwUser, setPwUser] = useState<AppUserRow | null>(null);
  const [pwValue, setPwValue] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    try {
      await createFn({ data: { token, username: newUsername, password: newPassword, role: newRole } });
      toast.success("User created");
      setNewUsername("");
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
    if (!token) return;
    if (!confirm(`Delete account "${u.username}"? This cannot be undone.`)) return;
    try {
      await deleteFn({ data: { token, id: u.id } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["app_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function onToggleRole(u: AppUserRow) {
    if (!token) return;
    const cycle: Record<AppUserRow["role"], AppUserRow["role"]> = {
      admin: "user",
      user: "reception",
      reception: "admin",
    };
    const next = cycle[u.role];
    try {
      await roleFn({ data: { token, id: u.id, role: next } });
      toast.success(`Role updated to ${next}`);
      qc.invalidateQueries({ queryKey: ["app_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function onSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !pwUser) return;
    try {
      await pwFn({ data: { token, id: pwUser.id, password: pwValue } });
      toast.success("Password updated");
      setPwUser(null);
      setPwValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Users</DialogTitle>
            <DialogDescription>Add, edit roles, reset passwords, or remove user accounts.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Add a user</h2>
              <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Username</label>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Password</label>
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Role</label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "admin" | "user" | "reception")}
                  >
                    <option value="user">Housekeeper</option>
                    <option value="reception">Reception</option>
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
              <div className="px-4 py-3 border-b text-sm font-semibold">All users</div>
              {usersQ.isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : (
                <ul className="divide-y">
                  {(usersQ.data ?? []).map((u) => (
                    <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.username}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {u.role}{me && u.id === me.id ? " · you" : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setPwUser(u)} title="Reset password">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onToggleRole(u)}>
                          {u.role === "admin" ? "Make user" : u.role === "user" ? "Make reception" : "Make admin"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(u)}
                          disabled={!!me && u.id === me.id}
                          title={me && u.id === me.id ? "You cannot delete yourself" : "Delete user"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                  {(usersQ.data ?? []).length === 0 && (
                    <li className="p-4 text-sm text-muted-foreground">No users yet.</li>
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
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPwUser(null)}>Cancel</Button>
              <Button type="submit" size="sm">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}