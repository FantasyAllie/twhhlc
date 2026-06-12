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
  type AppUserRow,
} from "@/lib/auth.functions";
import { getToken, getStoredUser, clearSession } from "@/lib/auth-client";
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
import { ArrowLeft, Trash2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/users")({
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
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<ReturnType<typeof getStoredUser>>(null);

  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const deleteFn = useServerFn(deleteUser);
  const pwFn = useServerFn(updateUserPassword);
  const roleFn = useServerFn(updateUserRole);

  useEffect(() => {
    const t = getToken();
    const u = getStoredUser();
    if (!t || !u) {
      navigate({ to: "/login" });
      return;
    }
    if (u.role !== "admin") {
      navigate({ to: "/app" });
      return;
    }
    setToken(t);
    setMe(u);
  }, [navigate]);

  const usersQ = useQuery({
    queryKey: ["app_users"],
    enabled: !!token,
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

  function signOut() {
    clearSession();
    navigate({ to: "/login" });
  }

  if (!token || !me) return null;

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
                <option value="user">User</option>
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
                    <div className="text-xs text-muted-foreground capitalize">{u.role}{u.id === me.id ? " · you" : ""}</div>
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
                      disabled={u.id === me.id}
                      title={u.id === me.id ? "You cannot delete yourself" : "Delete user"}
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
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPwUser(null)}>Cancel</Button>
              <Button type="submit" size="sm">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}