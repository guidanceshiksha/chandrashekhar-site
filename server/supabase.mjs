/* Minimal Supabase REST client (no dependencies). Used by the Vercel admin API, the build and the seed script.
   Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the new sb_secret_... key or the legacy service_role key).
   Data lives in one table, site_content (key, value jsonb), and files in the public Storage bucket "media". */
const BUCKET = "media";

const secretKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
const baseUrl = () => {
  let url = (process.env.SUPABASE_URL || "").trim().replace(/^['"]|['"]$/g, "").trim().replace(/\/+$/, "").replace(/\/(rest|storage)\/v1$/, "");
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
};

export const configured = () => Boolean(baseUrl() && secretKey());

const authHeaders = (extra = {}) => {
  const key = secretKey();
  // New-style sb_secret_ keys are not JWTs and go in the apikey header only; legacy service_role keys are JWTs.
  return key.startsWith("sb_") ? { apikey: key, ...extra } : { apikey: key, Authorization: `Bearer ${key}`, ...extra };
};

async function call(method, route, { headers, body } = {}) {
  let response;
  try { response = await fetch(baseUrl() + route, { method, headers: authHeaders(headers), body, signal: AbortSignal.timeout(20000) }); }
  catch (error) { throw Object.assign(new Error(`Could not reach Supabase (${error.cause?.code || error.message}). Check that SUPABASE_URL is the Project URL, like https://abcdefgh.supabase.co`), { status: 502 }); }
  if (!response.ok) {
    let detail = "";
    try { const data = await response.json(); detail = data.message || data.error || ""; } catch { /* no body */ }
    throw Object.assign(new Error(`Supabase ${method} ${route.split("?")[0]} failed (${response.status}${detail ? ": " + detail : ""}).`), { status: 502 });
  }
  return response;
}

/* The editable content rows. Leaves out the private "admin" row (sign-in hash) and the public copies ("public", "post:<slug>"). */
export async function getContent() {
  const rows = await (await call("GET", "/rest/v1/site_content?select=key,value&key=neq.admin&key=neq.public&key=not.like.post:*")).json();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export const supabaseUrl = () => baseUrl();

/* Keys that start with `prefix` (used to find stale "post:<slug>" rows). */
export async function listKeys(prefix) {
  const rows = await (await call("GET", `/rest/v1/site_content?select=key&key=like.${encodeURIComponent(prefix)}*`)).json();
  return rows.map((row) => row.key);
}

export async function deleteKeys(keys) {
  if (!keys.length) return;
  const list = keys.map((k) => `"${k.replace(/"/g, "")}"`).join(",");
  await call("DELETE", `/rest/v1/site_content?key=in.(${encodeURIComponent(list)})`);
}

/* Writes several rows in one request. */
export async function setMany(entries) {
  if (!entries.length) return;
  const now = new Date().toISOString();
  await call("POST", "/rest/v1/site_content?on_conflict=key", {
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(entries.map(([key, value]) => ({ key, value, updated_at: now }))),
  });
}

export async function getOne(key) {
  const rows = await (await call("GET", `/rest/v1/site_content?select=value&key=eq.${encodeURIComponent(key)}`)).json();
  return rows[0]?.value ?? null;
}

export async function setContent(key, value) {
  await call("POST", "/rest/v1/site_content?on_conflict=key", {
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
}

const objectPath = (file) => file.split("/").map(encodeURIComponent).join("/");

export async function uploadMedia(file, bytes, contentType) {
  await call("POST", `/storage/v1/object/${BUCKET}/${objectPath(file)}`, { headers: { "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000" }, body: bytes });
  return publicUrl(file);
}

export async function deleteMedia(file) {
  try { await call("DELETE", `/storage/v1/object/${BUCKET}/${objectPath(file)}`); } catch { /* already gone */ }
}

export const publicUrl = (file) => `${baseUrl()}/storage/v1/object/public/${BUCKET}/${objectPath(file)}`;

/* Storage path of one of our own public image URLs ("" for anything else, such as an external link). */
export const mediaPath = (url) => {
  const prefix = publicUrl("");
  if (typeof url !== "string" || !url.startsWith(prefix)) return "";
  try { return decodeURIComponent(url.slice(prefix.length).split("?")[0]); } catch { return ""; }
};

/* Starts a new Vercel build so the public site picks up the change. */
export async function triggerDeploy() {
  const hook = (process.env.DEPLOY_HOOK_URL || "").trim();
  if (!hook) return "not-configured";
  try { const r = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(10000) }); return r.ok ? "triggered" : "failed"; }
  catch { return "failed"; }
}
