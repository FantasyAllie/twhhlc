// Sends notifications to the iPhone app through Apple's push service (APNs),
// signed with the key in APNS_KEY (the .p8 file's contents), APNS_KEY_ID and APNS_TEAM_ID.

export type ApnsConfig = { key: string; keyId: string; teamId: string };

export type ApnsDevice = { token: string; environment: string; bundle_id: string };

export type ApnsResult = { token: string; ok: boolean; gone: boolean; status: number; reason?: string };

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlText = (text: string): string => b64url(new TextEncoder().encode(text));

function pemToBytes(pem: string): Uint8Array {
  // Secrets are often pasted with literal "\n" instead of line breaks.
  const base64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// Apple wants one token reused for 20-60 minutes, and throttles new ones.
let cached: { jwt: string; issuedAt: number; keyId: string } | null = null;

async function providerToken(config: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.keyId === config.keyId && now - cached.issuedAt < 50 * 60) return cached.jwt;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(config.key),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const unsigned = `${b64urlText(JSON.stringify({ alg: "ES256", kid: config.keyId }))}.${b64urlText(
    JSON.stringify({ iss: config.teamId, iat: now }),
  )}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(new Uint8Array(signature))}`;
  cached = { jwt, issuedAt: now, keyId: config.keyId };
  return jwt;
}

export async function sendApns(
  devices: ApnsDevice[],
  message: { title: string; body: string; tag?: string },
  config: ApnsConfig,
): Promise<ApnsResult[]> {
  const jwt = await providerToken(config);
  const payload = JSON.stringify({
    aps: { alert: { title: message.title, body: message.body }, sound: "default" },
  });
  return Promise.all(
    devices.map(async (device): Promise<ApnsResult> => {
      const host = device.environment === "production"
        ? "api.push.apple.com"
        : "api.sandbox.push.apple.com";
      try {
        const headers: Record<string, string> = {
          authorization: `bearer ${jwt}`,
          "apns-topic": device.bundle_id,
          "apns-push-type": "alert",
          "apns-priority": "10",
        };
        // Apple limits collapse ids to 64 bytes.
        if (message.tag) headers["apns-collapse-id"] = message.tag.slice(0, 64);
        const response = await fetch(`https://${host}/3/device/${device.token}`, {
          method: "POST",
          headers,
          body: payload,
        });
        if (response.ok) return { token: device.token, ok: true, gone: false, status: response.status };
        const reason = ((await response.json().catch(() => ({}))) as { reason?: string }).reason;
        const gone = response.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
        return { token: device.token, ok: false, gone, status: response.status, reason };
      } catch (error) {
        return {
          token: device.token, ok: false, gone: false, status: 0,
          reason: error instanceof Error ? error.message : "Request failed",
        };
      }
    }),
  );
}
