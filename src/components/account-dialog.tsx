// Account settings dialog: username, email, password and linked providers.
// Extracted verbatim from src/routes/app.tsx (stage 5).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStoredUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { AvatarEditor } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AccountDialog({
  open,
  onOpenChange,
  currentUsername,
  onUsernameChanged,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUsername: string;
  onUsernameChanged: (u: string) => void;
  onSignOut: () => void;
}) {
  const [username, setUsername] = useState(currentUsername);
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [identities, setIdentities] = useState<Array<{ identity_id: string; provider: string }>>([]);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  async function refreshIdentities() {
    const { data } = await supabase.auth.getUserIdentities();
    const list = (data?.identities ?? []).map((i) => ({ identity_id: i.identity_id, provider: i.provider }));
    setIdentities(list);
    setHasPassword(list.some((i) => i.provider === "email"));
  }

  useEffect(() => {
    if (open) {
      setUsername(currentUsername);
      setNewEmail("");
      setNewPw("");
      setConfirmPw("");
      setCurrentPw("");
      void refreshIdentities();
    }
  }, [open, currentUsername]);

  async function linkProvider(provider: "google" | "apple") {
    if (linkingProvider) return;
    setLinkingProvider(provider);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
      // Browser will redirect to the provider; nothing else to do here.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to link ${provider}`);
      setLinkingProvider(null);
    }
  }

  async function unlinkProvider(identity: { identity_id: string; provider: string }) {
    if (linkingProvider) return;
    if (identities.length <= 1) {
      toast.error("Add another sign-in method before removing this one");
      return;
    }
    setLinkingProvider(identity.provider);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity as never);
      if (error) throw error;
      toast.success(`Disconnected ${identity.provider}`);
      await refreshIdentities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to disconnect ${identity.provider}`);
    } finally {
      setLinkingProvider(null);
    }
  }

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const user = getStoredUser();
    if (!user) { toast.error("Not signed in"); return; }

    const trimmedUsername = username.trim();
    const trimmedEmail = newEmail.trim();
    const wantsUsername = trimmedUsername !== "" && trimmedUsername !== currentUsername;
    const wantsEmail = trimmedEmail !== "" && trimmedEmail.toLowerCase() !== user.email.toLowerCase();
    const wantsPassword = newPw.length > 0 || confirmPw.length > 0;

    if (!wantsUsername && !wantsEmail && !wantsPassword) {
      toast.info("Nothing to change");
      return;
    }
    if (wantsPassword && newPw !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    const needsCurrentPw = hasPassword && (wantsEmail || wantsPassword);
    if (needsCurrentPw && !currentPw) {
      toast.error("Enter your current password to save changes");
      return;
    }

    setBusy(true);
    try {
      if (needsCurrentPw) {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPw,
        });
        if (signErr) throw new Error("Current password is incorrect");
      }

      const messages: string[] = [];

      if (wantsUsername) {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ display_name: trimmedUsername })
          .eq("id", user.id);
        if (pErr) throw pErr;
        await supabase.auth.updateUser({ data: { display_name: trimmedUsername } });
        const { refreshSession } = await import("@/lib/auth-client");
        await refreshSession();
        onUsernameChanged(trimmedUsername);
        messages.push("Username updated");
      }

      if (wantsEmail) {
        const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (error) throw error;
        messages.push("Check your new email to confirm the change");
      }

      if (wantsPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPw });
        if (error) throw error;
        messages.push(hasPassword ? "Password updated" : "Password set");
      }

      toast.success(messages.join(" · "));
      setNewEmail("");
      setNewPw("");
      setConfirmPw("");
      setCurrentPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>
            Update your username, email, or password.{hasPassword ? " Enter your current password once at the bottom to save email or password changes." : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={saveAll} className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Display photo</h3>
            <AvatarEditor username={currentUsername} />
          </div>
          <div className="border-t" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">New username</h3>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={currentUsername}
            />
          </div>
          <div className="border-t" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">New email</h3>
            <p className="text-xs text-muted-foreground">
              We'll send a confirmation link to the new address. The change takes effect once confirmed.
            </p>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="name@example.com"
            />
          </div>
          <div className="border-t" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{hasPassword ? "New password" : "Set a password"}</h3>
            {!hasPassword && (
              <p className="text-xs text-muted-foreground">
                You signed in with Google. Setting a password lets you also sign in with email.
              </p>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium">New password</label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Confirm new password</label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          {hasPassword && (
            <>
              <div className="border-t" />
              <div className="space-y-2">
                <label className="text-xs font-medium">Enter existing password to save changes</label>
                <p className="text-xs text-muted-foreground">Only required when changing your email or password.</p>
                <Input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </>
          )}
          <div className="border-t" />
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Linked sign-in methods</h3>
              <p className="text-xs text-muted-foreground">
                Connect Google or Apple to sign in to this same account with either provider.
              </p>
            </div>
            {(["google", "apple"] as const).map((provider) => {
              const linked = identities.find((i) => i.provider === provider);
              const label = provider === "google" ? "Google" : "Apple";
              return (
                <div key={provider} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                  <div className="text-sm">
                    <span className="font-medium">{label}</span>
                    <span className={`ml-2 text-xs ${linked ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {linked ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  {linked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={linkingProvider === provider || identities.length <= 1}
                      onClick={() => void unlinkProvider(linked)}
                    >
                      {linkingProvider === provider ? "…" : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={linkingProvider !== null}
                      onClick={() => void linkProvider(provider)}
                    >
                      {linkingProvider === provider ? "Redirecting…" : "Connect"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-1">
            <Button type="submit" size="sm" disabled={busy}>Save changes</Button>
          </div>
        </form>
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => { onOpenChange(false); onSignOut(); }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
