import { useEffect, useState } from "react";
import { Bell, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  enablePushOnThisDevice,
  disablePushOnThisDevice,
  getCurrentSubscription,
  isInstalledStandalone,
  isIos,
  isPushSupported,
} from "@/lib/push-client";
import {
  getNotificationPrefs,
  setNotificationPrefs,
  sendTestNotification,
  type NotificationPrefs,
  type MessagesDepartment,
} from "@/lib/push.functions";
import { getToken } from "@/lib/auth-client";

const DEFAULT_PREFS: NotificationPrefs = {
  messages_enabled: true,
  checkout_enabled: true,
  done_enabled: true,
  notify_from_reception: true,
  notify_from_housekeeping: true,
  notify_from_fnb: true,
  notify_from_maintenance: true,
  notify_maintenance_requests: true,
};

export function NotificationsSheet({
  open,
  onOpenChange,
  userRole,
  myDepartments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userRole: "admin" | "user" | "reception" | "maintenance";
  myDepartments?: MessagesDepartment[];
}) {
  const supported = typeof window !== "undefined" && isPushSupported();
  const onIos = typeof window !== "undefined" && isIos();
  const installed = typeof window !== "undefined" && isInstalledStandalone();
  const iosNeedsInstall = onIos && !installed;

  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        if (supported) {
          const sub = await getCurrentSubscription();
          if (!cancelled) setSubscribed(!!sub);
        }
        if (typeof Notification !== "undefined") setPermission(Notification.permission);
        if (getToken()) {
          const p = await getNotificationPrefs();
          if (!cancelled) setPrefs(p);
        }
      } catch (_e) {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supported]);

  const togglePush = async (enable: boolean) => {
    setBusy(true);
    try {
      if (enable) {
        const res = await enablePushOnThisDevice();
        if (!res.ok) {
          toast.error(res.reason ?? "Could not enable notifications");
          return;
        }
        setSubscribed(true);
        setPermission("granted");
        toast.success("Notifications enabled on this device");
      } else {
        await disablePushOnThisDevice();
        setSubscribed(false);
        toast.success("Notifications disabled on this device");
      }
    } finally {
      setBusy(false);
    }
  };

  const updatePref = async (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (!getToken()) return;
    try {
      await setNotificationPrefs({ data: { ...patch } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save preference");
    }
  };

  const sendTest = async () => {
    if (!getToken()) return;
    setBusy(true);
    try {
      const res = await sendTestNotification();
      if (res.sent === 0) toast.error("No subscribed devices for this user.");
      else toast.success(`Test sent to ${res.sent} device${res.sent === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send test");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </SheetTitle>
          <SheetDescription>
            Get a system push alert for room activity even when the app is closed.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {!supported && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              Push notifications are not supported by this browser. Try Chrome/Edge on desktop or
              Android, or install this app to your Home Screen on iOS 16.4+.
            </div>
          )}

          {supported && iosNeedsInstall && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm">
              <Smartphone className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Install required on iPhone/iPad</p>
                <p className="text-amber-800/80 dark:text-amber-200/80 mt-1">
                  Tap the Share button in Safari, then "Add to Home Screen". Open the app from your
                  Home Screen icon, then come back here to enable notifications.
                </p>
              </div>
            </div>
          )}

          {supported && !iosNeedsInstall && (
            <div className="rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">This device</p>
                  <p className="text-xs text-muted-foreground">
                    {subscribed
                      ? "Subscribed — you'll receive pushes here."
                      : permission === "denied"
                        ? "Permission blocked in browser settings."
                        : "Not enabled yet."}
                  </p>
                </div>
                <Switch
                  checked={subscribed}
                  disabled={busy || permission === "denied"}
                  onCheckedChange={(v) => void togglePush(v)}
                />
              </div>
              {subscribed && (
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void sendTest()}>
                    Send test notification
                  </Button>
                </div>
              )}
              {permission === "denied" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Re-enable in your browser's site settings, then toggle this on again.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 rounded-md border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notify me about
            </p>
            <div className="space-y-2">
              {userRole !== "reception" && (
                <PrefRow
                  label="A room is marked checked out by reception"
                  checked={prefs.checkout_enabled}
                  onChange={(v) => void updatePref({ checkout_enabled: v })}
                />
              )}
              {userRole !== "user" && (
                <PrefRow
                  label="A room is marked done by housekeeping"
                  checked={prefs.done_enabled}
                  onChange={(v) => void updatePref({ done_enabled: v })}
                />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              These preferences apply to your account on every device.
            </p>
          </div>

          <div className="space-y-2 rounded-md border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notify me about new messages from
            </p>
            <div className="space-y-2">
              {(["reception", "housekeeping", "fnb", "maintenance"] as MessagesDepartment[])
                .filter((d) => !(myDepartments ?? []).includes(d) || (myDepartments ?? []).length > 1)
                .map((d) => (
                  <PrefRow
                    key={d}
                    label={
                      d === "reception"
                        ? "Reception"
                        : d === "housekeeping"
                        ? "Housekeeping"
                        : d === "fnb"
                        ? "F&B"
                        : "Maintenance"
                    }
                    checked={
                      d === "reception"
                        ? prefs.notify_from_reception
                        : d === "housekeeping"
                        ? prefs.notify_from_housekeeping
                        : d === "fnb"
                        ? prefs.notify_from_fnb
                        : prefs.notify_from_maintenance
                    }
                    onChange={(v) =>
                      void updatePref(
                        d === "reception"
                          ? { notify_from_reception: v }
                          : d === "housekeeping"
                          ? { notify_from_housekeeping: v }
                          : d === "fnb"
                          ? { notify_from_fnb: v }
                          : { notify_from_maintenance: v },
                      )
                    }
                  />
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Applies to the Messages window between departments.
            </p>
          </div>

          {(userRole === "admin" || userRole === "maintenance" || (myDepartments ?? []).includes("maintenance")) && (
            <div className="space-y-2 rounded-md border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Maintenance requests
              </p>
              <PrefRow
                label="New maintenance request from Housekeeping or Reception"
                checked={prefs.notify_maintenance_requests}
                onChange={(v) => void updatePref({ notify_maintenance_requests: v })}
              />
              <p className="text-[11px] text-muted-foreground pt-1">
                Get a push when Housekeeping or Reception log a new maintenance job.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PrefRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}