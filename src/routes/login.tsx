import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { refreshSession } from "@/lib/auth-client";
import { useServerFn } from "@tanstack/react-start";
import { listMyHotels, setActiveHotel, type HotelOption } from "@/lib/auth.functions";
import tsuyuLogo from "@/assets/tsuyu-logo.png";
// Tsuyu's Dawn drop (the same artwork as the apps' icons).
const logoUrl = tsuyuLogo;

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Tsuyu" },
      { name: "description", content: "Sign in to Tsuyu." },
      { property: "og:title", content: "Sign in — Tsuyu" },
      { property: "og:description", content: "Sign in to Tsuyu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
      <div className="max-w-sm text-center">
        <p className="mb-4">{error instanceof Error ? error.message : String(error)}</p>
        <Button onClick={reset} size="sm">Try again</Button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Page not found</div>,
});

type Mode = "signin" | "signup" | "forgot";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hotelChoices, setHotelChoices] = useState<HotelOption[] | null>(null);
  const listMyHotelsFn = useServerFn(listMyHotels);
  const setActiveHotelFn = useServerFn(setActiveHotel);

  async function proceedAfterAuth() {
    // Everyone with more than one assigned hotel picks which one they're
    // working at today. A single-hotel user is auto-set and goes straight in.
    try {
      const hotels = (await listMyHotelsFn()) as HotelOption[];
      if (hotels.length > 1) {
        setHotelChoices(hotels);
        return;
      }
      if (hotels.length === 1) {
        await setActiveHotelFn({ data: { hotelId: hotels[0].id } });
      }
    } catch {
      /* pending/no-hotel accounts fall through */
    }
    navigate({ to: "/app", replace: true });
  }

  async function chooseWorkspace(hotelId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await setActiveHotelFn({ data: { hotelId } });
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open workspace");
    } finally {
      setBusy(false);
    }
  }

  // If already signed in, route to /app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await refreshSession();
      await proceedAfterAuth();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: displayName.trim() ? { display_name: displayName.trim() } : {},
        },
      });
      if (error) throw error;
      await refreshSession();
      toast.success("Account created. An admin will approve access shortly.");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent.");
      setMode("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      await refreshSession();
      await proceedAfterAuth();
    } finally {
      setBusy(false);
    }
  }

  async function onApple() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Apple sign-in failed");
        return;
      }
      if (result.redirected) return;
      await refreshSession();
      await proceedAfterAuth();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      {hotelChoices ? (
        <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-2 text-center">
            <img src={logoUrl} alt="" className="mx-auto h-16 w-16 rounded-[14px] object-contain shadow-sm" />
            <h1 className="text-xl font-semibold">Choose a workspace</h1>
            <p className="text-sm text-muted-foreground">
              Select the hotel you want to open. You'll need to sign out to switch.
            </p>
          </div>
          <div className="space-y-2">
            {hotelChoices.map((h) => (
              <Button
                key={h.id}
                variant="outline"
                className="w-full justify-start"
                disabled={busy}
                onClick={() => void chooseWorkspace(h.id)}
              >
                {h.name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
      <div className="w-full max-w-sm space-y-7">
        {/* The icon, the name with 露 (dew), then what this screen is for. */}
        <div className="flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt=""
            className="h-[88px] w-[88px] rounded-[20px] object-contain shadow-[0_10px_28px_rgba(19,34,56,0.16)]"
          />
          {/* 露 sits beside the name, on the same baseline. */}
          <div className="mt-6 flex items-baseline justify-center gap-2.5">
            <h1 className="text-[44px] font-semibold leading-none tracking-tight">Tsuyu</h1>
            <span lang="ja" aria-label="Tsuyu, dew in Japanese" className="text-[30px] font-semibold leading-none text-[#6E62A8] dark:text-[#B9AEE6]">露</span>
          </div>
          <p className="mt-4 text-[15px] text-muted-foreground">
            {mode === "signup"
              ? "Create your account"
              : mode === "forgot"
                ? "Reset your password"
                : "Sign in to your hotel workspace"}
          </p>
        </div>
      <div className="space-y-4 rounded-3xl border bg-card p-5 shadow-sm">

        {mode !== "forgot" && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onGoogle}
              disabled={busy}
            >
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onApple}
              disabled={busy}
            >
              Continue with Apple
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
          </>
        )}

        <form
          onSubmit={mode === "signin" ? onSignIn : mode === "signup" ? onSignUp : onForgot}
          className="space-y-3"
        >
          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="dn">Display name</label>
              <Input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoCapitalize="words"
                placeholder="e.g. Allie"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="em">Email</label>
            <Input
              id="em"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="pw">Password</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input
                id="pw"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-ink text-base font-semibold text-ink-foreground hover:bg-ink/90 dark:bg-[#D8D0F0] dark:text-[#132238] dark:hover:bg-[#D8D0F0]/90">
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset email"}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>New here?{" "}
              <button className="underline" onClick={() => setMode("signup")}>Create an account</button>
            </>
          ) : (
            <button className="underline" onClick={() => setMode("signin")}>Back to sign in</button>
          )}
        </div>
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground text-center">
            New accounts need an admin to approve access before you can use the app.
          </p>
        )}
      </div>
      </div>
      )}
    </div>
  );
}