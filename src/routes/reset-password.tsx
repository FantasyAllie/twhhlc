import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — TW Housekeeping" },
      { name: "description", content: "Set a new password for your account." },
    ],
  }),
  component: ResetPasswordPage,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm">
      <div className="max-w-sm text-center">
        <p className="mb-4">{error.message}</p>
        <Button onClick={reset} size="sm">Try again</Button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Page not found</div>,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase recovery links land here with a session in the URL hash.
    // Wait for the client to pick it up.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
      else {
        toast.error("This reset link is invalid or has expired.");
        navigate({ to: "/login", replace: true });
      }
    }, 200);
    return () => clearTimeout(t);
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-center">Set a new password</h1>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="np">New password</label>
          <Input
            id="np"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="cp">Confirm new password</label>
          <Input
            id="cp"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </div>
  );
}