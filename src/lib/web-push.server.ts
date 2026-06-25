// Pure Web Crypto implementation of Web Push (RFC 8030 + 8291 + VAPID RFC 8292).
// Worker-compatible (no Node imports). Server-only.

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(b: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// Parse uncompressed P-256 public key (0x04 || X || Y) into a JWK.
function p256PublicJwk(rawUncompressed: Uint8Array): JsonWebKey {
  if (rawUncompressed.length !== 65 || rawUncompressed[0] !== 0x04) {
    throw new Error("Invalid P-256 public key");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(rawUncompressed.slice(1, 33)),
    y: bytesToB64url(rawUncompressed.slice(33, 65)),
    ext: true,
  };
}

function p256PrivateJwk(rawScalar: Uint8Array, pub: Uint8Array): JsonWebKey {
  if (rawScalar.length !== 32) throw new Error("Invalid P-256 private scalar");
  const j = p256PublicJwk(pub);
  j.d = bytesToB64url(rawScalar);
  return j;
}

async function hkdf(
  ikm: BufferSource,
  salt: BufferSource,
  info: BufferSource,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as ArrayBuffer, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as ArrayBuffer, info: info as ArrayBuffer },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function ecdhSharedSecret(
  privJwk: JsonWebKey,
  pubJwk: JsonWebKey,
): Promise<Uint8Array> {
  const priv = await crypto.subtle.importKey(
    "jwk",
    privJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const pub = await crypto.subtle.importKey(
    "jwk",
    pubJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
  return new Uint8Array(bits);
}

async function encryptPayload(
  payload: Uint8Array,
  userPublicKeyRaw: Uint8Array,
  userAuthSecret: Uint8Array,
): Promise<{ body: Uint8Array }> {
  // Generate ephemeral ECDH keypair for the server.
  const ephKp = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const ephPrivJwk = (await crypto.subtle.exportKey("jwk", ephKp.privateKey)) as JsonWebKey;
  const ephPubJwk = (await crypto.subtle.exportKey("jwk", ephKp.publicKey)) as JsonWebKey;
  const ephPubRaw = concat(
    new Uint8Array([0x04]),
    b64urlToBytes(ephPubJwk.x as string),
    b64urlToBytes(ephPubJwk.y as string),
  );

  const userPubJwk = p256PublicJwk(userPublicKeyRaw);
  const ecdhSecret = await ecdhSharedSecret(ephPrivJwk, userPubJwk);

  // PRK_key = HKDF-Extract(salt=authSecret, ikm=ecdhSecret)
  // IKM = HKDF-Expand(PRK_key, info="WebPush: info\0"||userPub||serverPub, L=32)
  const keyInfo = concat(enc.encode("WebPush: info\0"), userPublicKeyRaw, ephPubRaw);
  const ikm = await hkdf(
    ecdhSecret as unknown as BufferSource,
    userAuthSecret as unknown as BufferSource,
    keyInfo as unknown as BufferSource,
    32,
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(
    ikm as unknown as BufferSource,
    salt as unknown as BufferSource,
    enc.encode("Content-Encoding: aes128gcm\0") as unknown as BufferSource,
    16,
  );
  const nonce = await hkdf(
    ikm as unknown as BufferSource,
    salt as unknown as BufferSource,
    enc.encode("Content-Encoding: nonce\0") as unknown as BufferSource,
    12,
  );

  // Plaintext with padding delimiter (single record, no extra padding).
  const padded = concat(payload, new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek as unknown as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as unknown as ArrayBuffer },
    aesKey,
    padded as unknown as ArrayBuffer,
  );
  const ct = new Uint8Array(ctBuf);

  // Header: salt(16) || rs(uint32 BE) || idlen(1) || keyid(idlen)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + ephPubRaw.length);
  header.set(salt, 0);
  // record size big-endian
  header[16] = (rs >>> 24) & 0xff;
  header[17] = (rs >>> 16) & 0xff;
  header[18] = (rs >>> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = ephPubRaw.length;
  header.set(ephPubRaw, 21);

  return { body: concat(header, ct) };
}

// DER-encode ECDSA r,s (each 32 bytes raw) — not used here since web-push
// requires JWS-style (just r||s concatenation). Web Crypto sign produces r||s.
async function signVapidJwt(
  audience: string,
  subject: string,
  privateKeyRaw: Uint8Array,
  publicKeyRaw: Uint8Array,
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12h
    sub: subject,
  };
  const headerB64 = bytesToB64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = bytesToB64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const priv = await crypto.subtle.importKey(
    "jwk",
    p256PrivateJwk(privateKeyRaw, publicKeyRaw),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      priv,
      enc.encode(signingInput) as unknown as ArrayBuffer,
    ),
  );
  return `${signingInput}.${bytesToB64url(sig)}`;
}

export type WebPushSubscription = {
  endpoint: string;
  p256dh: string; // base64url uncompressed public key
  auth: string; // base64url 16-byte auth secret
};

export type SendPushResult = {
  endpoint: string;
  ok: boolean;
  status: number;
  gone: boolean; // 404/410 — caller should prune
  error?: string;
};

export async function sendWebPush(
  sub: WebPushSubscription,
  payload: string | Uint8Array,
  opts: {
    vapidPublicKey: string; // base64url raw
    vapidPrivateKey: string; // base64url raw scalar
    subject: string; // mailto: or https://
    ttl?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
  },
): Promise<SendPushResult> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const vapidPubRaw = b64urlToBytes(opts.vapidPublicKey);
    const vapidPrivRaw = b64urlToBytes(opts.vapidPrivateKey);
    const jwt = await signVapidJwt(audience, opts.subject, vapidPrivRaw, vapidPubRaw);

    const data = typeof payload === "string" ? enc.encode(payload) : payload;
    const userPub = b64urlToBytes(sub.p256dh);
    const userAuth = b64urlToBytes(sub.auth);
    const { body } = await encryptPayload(data, userPub, userAuth);

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": String(opts.ttl ?? 60 * 60 * 24),
      "Authorization": `vapid t=${jwt}, k=${opts.vapidPublicKey}`,
      "Urgency": opts.urgency ?? "normal",
    };
    if (opts.topic) headers["Topic"] = opts.topic;

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers,
      body: body as BodyInit,
    });
    const gone = res.status === 404 || res.status === 410;
    return {
      endpoint: sub.endpoint,
      ok: res.ok,
      status: res.status,
      gone,
      error: res.ok ? undefined : await res.text().catch(() => ""),
    };
  } catch (e) {
    return {
      endpoint: sub.endpoint,
      ok: false,
      status: 0,
      gone: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}