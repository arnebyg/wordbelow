// Push to the Android app through Firebase Cloud Messaging (the HTTP v1 API), without a library: the Firebase
// project's service account signs a token (RS256 JWT), Google trades it for an access token, and one POST per message.
//
// Needs one value, set once with wrangler (nothing is in the repo):
//   npx wrangler versions secret put FCM_SERVICE_ACCOUNT
// with the whole JSON file from Firebase › Project settings › Service accounts › Generate new private key (project wordbelow).
// Without it the Android phones are kept in the list but get nothing.
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uText = (s) => b64u(enc.encode(s));

export function fcmReady(env) { return !!(env && env.FCM_SERVICE_ACCOUNT); }

// Google gives an access token for an hour; it is kept until five minutes before it runs out.
let cached = { exp: 0, token: null, project: null };
async function access(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && now < cached.exp - 300) return cached;
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = b64uText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64uText(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head + "." + body));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + body + "." + b64u(sig) });
  if (!r.ok) throw new Error("fcm token " + r.status);
  const d = await r.json();
  cached = { exp: now + (d.expires_in || 3600), token: d.access_token, project: sa.project_id };
  return cached;
}

// endpoint is "fcm:<registration token>". Resolves to the status; 404 (UNREGISTERED) means the phone is gone and is
// taken out of the list, and a token Google calls invalid is treated the same.
export async function sendFcm(env, endpoint, data) {
  const a = await access(env), token = endpoint.slice(4);
  const message = { token, notification: { title: data.title, body: data.body }, data: { game: data.game || "" },
    android: { priority: "HIGH", ttl: "86400s", notification: { tag: data.game || "wordbelow", sound: "default" } } };
  const r = await fetch("https://fcm.googleapis.com/v1/projects/" + a.project + "/messages:send", { method: "POST",
    headers: { authorization: "Bearer " + a.token, "content-type": "application/json" }, body: JSON.stringify({ message }) });
  if (r.status === 400) { const e = (await r.json().catch(() => ({}))).error || {}; return e.status === "INVALID_ARGUMENT" && /token/i.test(e.message || "") ? 410 : 400; }
  return r.status === 404 ? 410 : r.status;
}
