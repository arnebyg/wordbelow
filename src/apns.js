// Push to the iPhone app through Apple's own service (APNs), without a library: a token signed with the
// developer's APNs key (ES256 JWT), and one HTTP/2 POST per message.
//
// Needs three values, set once with wrangler (nothing is in the repo):
//   npx wrangler secret put APNS_KEY       the .p8 file's text, from Apple Developer › Keys (Apple Push Notifications service)
//   npx wrangler secret put APNS_KEY_ID    the key's ten-character id
//   npx wrangler secret put APNS_TEAM_ID   the team id (Apple Developer › Membership)
// Without them the app's phones are kept in the list but get nothing; the web page's push goes on as before.
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const TOPIC = "app.wordbelow";

// Apple takes a token for up to an hour and asks that it is not made anew for every message.
let cached = { at: 0, jwt: null, kid: null };
async function jwt(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cached.jwt && cached.kid === env.APNS_KEY_ID && now - cached.at < 45 * 60) return cached.jwt;
  const pem = String(env.APNS_KEY).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(enc.encode(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID })));
  const body = b64u(enc.encode(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: now })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body));
  cached = { at: now, jwt: head + "." + body + "." + b64u(sig), kid: env.APNS_KEY_ID };
  return cached.jwt;
}

export function apnsReady(env) { return !!(env && env.APNS_KEY && env.APNS_KEY_ID && env.APNS_TEAM_ID); }

// endpoint is "apns:<device token>"; a token the production service does not know is tried once in the sandbox (a build from Xcode).
// Resolves to Apple's status; 410, and 400 with BadDeviceToken, mean the phone is gone and is taken out of the list.
export async function sendApns(env, endpoint, data) {
  const dev = endpoint.startsWith("apns-dev:"), token = endpoint.slice(endpoint.indexOf(":") + 1);
  const host = dev ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const payload = { aps: { alert: { title: data.title, body: data.body }, sound: "default", "thread-id": data.game || "wordbelow" }, game: data.game || null };
  const r = await fetch(host + "/3/device/" + token, { method: "POST", body: JSON.stringify(payload), headers: {
    authorization: "bearer " + (await jwt(env)), "apns-topic": TOPIC, "apns-push-type": "alert", "apns-priority": "10",
    "apns-expiration": String(Math.floor(Date.now() / 1000) + 86400), "content-type": "application/json" } });
  if (r.status === 400) {
    const why = await r.json().catch(() => ({}));
    console.log("apns 400", why.reason || "");
    // A phone running a build from Xcode has a sandbox token, which the production service calls bad: try the sandbox once.
    if (why.reason === "BadDeviceToken" && !dev) return sendApns(env, "apns-dev:" + token, data);
    return why.reason === "BadDeviceToken" ? 410 : 400;
  }
  if (r.status !== 200) console.log("apns", r.status, (await r.text().catch(() => "")).slice(0, 120));
  return r.status;
}
