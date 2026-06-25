import {
  getVapidPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
} from "./push.functions";
import { getToken } from "./auth-client";

const SW_URL = "/sw.js";

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

export function isInstalledStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  // iOS reports navigator.standalone
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !!mql?.matches || iosStandalone;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: ArrayBuffer | null): string {
  if (!bytes) return "";
  const b = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function enablePushOnThisDevice(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "Push is not supported in this browser" };
  const token = getToken();
  if (!token) return { ok: false, reason: "Not signed in" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Notification permission was not granted" };
  }

  const reg = await ensureRegistration();
  // Wait until the SW is active before subscribing.
  if (!reg.active) {
    await new Promise<void>((resolve) => {
      const onState = () => {
        if (reg.active) resolve();
      };
      reg.addEventListener("updatefound", () => {
        const w = reg.installing ?? reg.waiting;
        w?.addEventListener("statechange", onState);
      });
      // Also resolve via the global ready promise.
      navigator.serviceWorker.ready.then(() => resolve()).catch(() => resolve());
    });
  }

  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) return { ok: false, reason: "Server VAPID key not configured" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const p256dh = json.keys?.p256dh ?? bytesToBase64Url(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? bytesToBase64Url(sub.getKey("auth"));
  const endpoint = json.endpoint ?? sub.endpoint;

  await subscribeToPush({
    data: {
      token,
      endpoint,
      p256dh,
      auth,
      userAgent: navigator.userAgent,
    },
  });

  return { ok: true };
}

export async function disablePushOnThisDevice(): Promise<void> {
  const token = getToken();
  const sub = await getCurrentSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    try {
      await sub.unsubscribe();
    } catch (_e) {
      /* ignore */
    }
    if (token) {
      try {
        await unsubscribeFromPush({ data: { token, endpoint } });
      } catch (_e) {
        /* ignore */
      }
    }
  }
}