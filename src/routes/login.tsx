import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { login } from "@/lib/auth.functions";
import { setSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — TW Linen Counter" },
      { name: "description", content: "Sign in to the linen counter." },
    ],
  }),
  component: LoginPage,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
      <div className="max-w-sm text-center">
        <p className="mb-4">{error.message}</p>
        <Button onClick={reset} size="sm">Try again</Button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Page not found</div>,
});

function LoginPage() {
  const navigate = useNavigate();
  const loginFn = useServerFn(login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { token, user } = await loginFn({ data: { username: username.trim(), password } });
      setSession(token, user);
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Three Ways House Hotel</h1>
          <p className="text-sm text-muted-foreground">Linen Counter — sign in</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="u">Username</label>
          <Input
            id="u"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="p">Password</label>
          <Input
            id="p"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Accounts are created by an administrator.
        </p>
      </form>
    </div>
  );
}