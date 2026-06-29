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
import { ArrowLeft, Trash2, KeyRound, Check, X } from "lucide-react";

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

  function nextCycleRole(r: AppUserRow["role"]): ApprovedRole {
    switch (r) {
      case "admin": return "manager";
      case "manager": return "user";
      case "user": return "reception";
      case "reception": return "admin";
      default: return "user";
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
                    <div className="font-medium truncate">{u.username}</div>
                    <div className="text-xs text-muted-foreground capitalize truncate">{u.role} · {u.email}{u.id === me.id ? " · you" : ""}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setPwUser(u)} title="Reset password">
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onSetRole(u, nextCycleRole(u.role))}>
                      {u.role === "admin" ? "Make manager" : u.role === "manager" ? "Make user" : u.role === "user" ? "Make reception" : "Make admin"}
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
    </div>
  );
}