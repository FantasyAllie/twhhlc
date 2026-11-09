// Sends notifications to the Android app through Firebase Cloud Messaging (HTTP v1),
// signed with the Firebase project's service account in FCM_SERVICE_ACCOUNT (the
// downloaded JSON key file's contents). Like apns.server.ts for the iPhone.

export type FcmServiceAccount = { client_email: string; private_key: string; project_id: string };

export type FcmDevice = { token: string };

export type FcmResult = { token: string; ok: boolean; gone: boolean; status: number; reason?: string };

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlText = (text: string): string => b64url(new TextEncoder().encode(text));

function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  // Secrets are often pasted with literal "\n" instead of line breaks.
  const base64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Reads FCM_SERVICE_ACCOUNT, or null if it isn't set (or isn't a service account). */
export function fcmServiceAccount(raw: string | undefined): FcmServiceAccount | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FcmServiceAccount>;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key, project_id: parsed.project_id };
  } catch {
    return null;
  }
}

// Google's access tokens last an hour; one is reused for 50 minutes.
let cached: { token: string; issuedAt: number; email: string } | null = null;

async function accessToken(account: FcmServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.email === account.client_email && now - cached.issuedAt < 50 * 60) return cached.token;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsigned = `${b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64urlText(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${b64url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`fcm token ${response.status}`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("fcm token missing");
  cached = { token: data.access_token, issuedAt: now, email: account.client_email };
  return data.access_token;
}

/** The message for one phone: shown by Android itself when the app is closed, on the app's Alerts channel. */
export function fcmMessage(token: string, message: { title: string; body: string; tag?: string }) {
  const tag = message.tag?.slice(0, 64);
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: { title: message.title, body: message.body, ...(tag ? { tag } : {}) },
      android: {
        priority: "high",
        notification: { channel_id: "alerts", sound: "default", ...(tag ? { tag } : {}) },
      },
    },
  };
}

export async function sendFcm(
  devices: FcmDevice[],
  message: { title: string; body: string; tag?: string },
  account: FcmServiceAccount,
): Promise<FcmResult[]> {
  const bearer = await accessToken(account);
  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  return Promise.all(
    devices.map(async (device): Promise<FcmResult> => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
          body: JSON.stringify(fcmMessage(device.token, message)),
        });
        if (response.ok) return { token: device.token, ok: true, gone: false, status: response.status };
        let reason = "";
        try {
          const data = (await response.json()) as {
            error?: { status?: string; details?: { errorCode?: string }[] };
          };
          reason = data.error?.details?.find((d) => d.errorCode)?.errorCode ?? data.error?.status ?? "";
        } catch {
          // No details.
        }
        // The app was removed, or the token was replaced: stop sending to it.
        const gone = response.status === 404 || reason === "UNREGISTERED";
        return { token: device.token, ok: false, gone, status: response.status, reason };
      } catch (error) {
        return { token: device.token, ok: false, gone: false, status: 0, reason: String(error) };
      }
    }),
  );
}
