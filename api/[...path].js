/* Online admin API for Vercel (serverless). Same routes as the local admin-server.mjs, but data lives in Supabase
   and every change starts a new Vercel build through DEPLOY_HOOK_URL. Sessions are signed cookies (no server memory). */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BLOG_POSTS } from "../src/blogData.mjs";
import { configured, deleteMedia, getOne, mediaPath, setContent, triggerDeploy, uploadMedia } from "../server/supabase.mjs";
import { syncLive } from "../server/live.mjs";

const MAX_BODY = 4.4 * 1024 * 1024; // Vercel functions accept at most 4.5 MB per request
const SESSION_SECONDS = 8 * 60 * 60;
const COOKIE = "blog_admin";
const attempts = new Map();

const sendJson = (res, status, payload, headers = {}) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(payload));
};
const fail = (status, message) => Object.assign(new Error(message), { status });

const readJson = (req, limit = 1024 * 1024) => new Promise((resolve, reject) => {
  if (req.body !== undefined) { // Vercel already parsed it
    try { return resolve(typeof req.body === "string" ? JSON.parse(req.body || "{}") : Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8") || "{}") : req.body || {}); }
    catch { return reject(fail(400, "Request body must be valid JSON.")); }
  }
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { body += chunk; if (Buffer.byteLength(body) > limit) { reject(fail(413, "Request body is too large.")); req.destroy(); } });
  req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { reject(fail(400, "Request body must be valid JSON.")); } });
  req.on("error", reject);
});

/* ---------- sign-in: Admin ID + password, signed-cookie sessions ---------- */
const secret = () => process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
  ? process.env.SESSION_SECRET
  : crypto.createHash("sha256").update(`fallback|${process.env.ADMIN_PASSWORD || ""}|${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""}`).digest("hex");
const sign = (text) => crypto.createHmac("sha256", secret()).update(text).digest("base64url");
const same = (a, b) => { const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 64);

let credCache = { at: 0, value: null };
async function credentials() {
  if (credCache.value && Date.now() - credCache.at < 30000) return credCache.value;
  credCache = { at: Date.now(), value: await loadCredentials() };
  return credCache.value;
}
async function loadCredentials() {
  const saved = await getOne("admin");
  if (saved?.salt && saved?.hash) return { username: saved.username, saved, version: saved.updatedAt || "saved" };
  const username = (process.env.ADMIN_USERNAME || "").trim();
  if (!username || !process.env.ADMIN_PASSWORD) throw fail(503, "Admin sign-in is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in Vercel.");
  return { username, saved: null, version: "env" };
}

function passwordOk(cred, password) {
  if (cred.saved) {
    const expected = Buffer.from(cred.saved.hash, "hex");
    const actual = hashPassword(password, Buffer.from(cred.saved.salt, "hex"));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  return same(password, process.env.ADMIN_PASSWORD);
}
const verifyCredentials = (cred, username, password) => same(String(username || "").trim().toLowerCase(), cred.username.toLowerCase()) && passwordOk(cred, password);

const makeToken = (csrf, version) => { const body = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000, csrf, v: version })).toString("base64url"); return `${body}.${sign(body)}`; };
const sessionCookie = (token, maxAge = SESSION_SECONDS) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}; Secure`;

function readSession(req) {
  const raw = (req.headers.cookie || "").split(";").map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig || !same(sig, sign(body))) return null;
  try { const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return data.exp > Date.now() ? data : null; } catch { return null; }
}

/* ---------- validation (same rules as the local admin) ---------- */
const slugify = (value) => String(value).normalize("NFKD").toLowerCase().replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

function validatePost(input, posts, previous = null) {
  const title = String(input.title || "").trim();
  const slug = slugify(input.slug || title);
  const category = String(input.category || "").trim();
  const date = String(input.date || "").trim();
  const excerpt = String(input.excerpt || "").trim();
  const status = input.status === "draft" ? "draft" : input.status === "published" ? "published" : "";
  const content = Array.isArray(input.content) ? input.content.map((part) => String(part).trim()).filter(Boolean) : [];
  const cover = String(input.cover || "").trim();
  const coverAlt = String(input.coverAlt || "").trim();
  const seoTitle = String(input.seoTitle || "").trim();
  const seoDescription = String(input.seoDescription || "").trim();
  const keywords = String(input.keywords || "").split(",").map((k) => k.trim()).filter(Boolean).join(", ");
  const errors = [];
  if (!title || title.length > 140) errors.push("Title is required and must be 140 characters or fewer.");
  if (!slug || slug.length > 80) errors.push("A valid URL slug is required.");
  if (!category || category.length > 60) errors.push("Category is required and must be 60 characters or fewer.");
  if (!date || date.length > 40) errors.push("Publication date is required.");
  if (!excerpt || excerpt.length > 320) errors.push("Excerpt is required and must be 320 characters or fewer.");
  if (!status) errors.push("Choose draft or published status.");
  if (content.length > 40 || content.join("\n").length > 40000) errors.push("Article content is too long (maximum 40 paragraphs and 40,000 characters).");
  if (status === "published" && !content.length) errors.push("Add article content before publishing.");
  if (coverAlt.length > 150) errors.push("Cover image description must be 150 characters or fewer.");
  if (seoTitle.length > 70) errors.push("SEO title must be 70 characters or fewer.");
  if (keywords.length > 200) errors.push("Keywords must be 200 characters or fewer.");
  if (seoDescription.length > 160) errors.push("SEO description must be 160 characters or fewer.");
  let coverUrl = "";
  if (cover) {
    try {
      const url = new URL(cover);
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"; // plain http is only accepted for a local Supabase while developing
      if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password) errors.push("Cover URL must use HTTPS and cannot contain credentials.");
      else coverUrl = url.href;
    } catch { errors.push("Cover must be an uploaded image or a valid HTTPS URL."); }
  }
  if (errors.length) throw fail(400, errors.join(" "));
  if (posts.some((post) => post.slug === slug && post.slug !== previous?.slug)) throw fail(409, "That URL slug is already used by another post.");
  return { slug, title, category, date, excerpt, cover: coverUrl, coverAlt, content, seoTitle, seoDescription, keywords, status, createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function validateSettings(input) {
  const errors = [];
  const text = (v, max) => String(v ?? "").trim().slice(0, max);
  const siteTitle = text(input.siteTitle, 70);
  const metaDescription = text(input.metaDescription, 200);
  const whatsapp = String(input.whatsapp ?? "").replace(/\D/g, "");
  const email = text(input.email, 120);
  const office = text(input.office, 160);
  const phones = (Array.isArray(input.phones) ? input.phones : []).map((p) => text(p, 25)).filter(Boolean);
  const socials = (Array.isArray(input.socials) ? input.socials : []).map((s) => ({ name: text(s?.name, 30), url: text(s?.url, 300) })).filter((s) => s.name || s.url);
  if (!siteTitle) errors.push("Site title is required.");
  if (!metaDescription) errors.push("Site description is required.");
  if (whatsapp.length < 10 || whatsapp.length > 15) errors.push("WhatsApp number must be 10 to 15 digits including the country code, for example 918826252304.");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("Enter a valid email address.");
  if (phones.some((p) => p.replace(/\D/g, "").length < 8)) errors.push("Each phone number needs at least 8 digits.");
  if (phones.length > 4) errors.push("Add at most 4 phone numbers.");
  if (socials.length > 10) errors.push("Add at most 10 social links.");
  for (const s of socials) {
    if (!s.name) { errors.push("Every social link needs a name."); break; }
    try { const u = new URL(s.url); if (u.protocol !== "https:" || u.username || u.password) throw new Error(); }
    catch { errors.push(`The link for “${s.name}” must be a valid https:// URL.`); }
  }
  if (errors.length) throw fail(400, errors.join(" "));
  return { siteTitle, metaDescription, whatsapp, phones, email, office, socials };
}

/* ---------- images ---------- */
function decodeImage(body) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(body.data || ""));
  if (!match) throw fail(400, "Upload a JPEG, PNG, or WebP image.");
  const bytes = Buffer.from(match[2], "base64");
  const valid = {
    jpeg: bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    png: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    webp: bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
  };
  if (!valid[match[1]]) throw fail(400, "The file contents do not match the image format.");
  return { bytes, extension: match[1] === "jpeg" ? "jpg" : match[1] };
}

let sharpLib = null;
try { sharpLib = (await import("sharp")).default; sharpLib.cache(false); } catch { /* optional: the image is stored as sent */ }
async function optimizeImage({ bytes, extension }, maxSide) {
  if (!sharpLib) return { bytes, extension };
  try { return { bytes: await sharpLib(bytes).rotate().resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(), extension: "webp" }; }
  catch { return { bytes, extension }; }
}
/* Small copy (640 px) used by the gallery grid so visitors do not download the full photo for every tile. */
async function makeThumb(bytes) {
  if (!sharpLib) return null;
  try { return await sharpLib(bytes).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(); }
  catch { return null; }
}
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const bodyLimit = () => MAX_BODY;
const readImage = async (req, side) => optimizeImage(decodeImage(await readJson(req, bodyLimit())), side);

/* Deletes a blog cover from storage once no post uses it (uploads only; external image URLs are left alone). */
async function dropCoverIfUnused(url, remainingPosts) {
  const file = mediaPath(url);
  if (file.startsWith("blog/") && !remainingPosts.some((p) => p.cover === url)) await deleteMedia(file);
}

const defaultPosts = () => BLOG_POSTS.map((post) => ({ status: "published", ...post }));
const defaultSettings = () => { try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "siteSettings.json"), "utf8")); } catch { return { siteTitle: "", metaDescription: "", whatsapp: "", phones: [], email: "", office: "", socials: [] }; } };

/* ---------- routes ---------- */
async function route(req, res, url) {
  const method = req.method;
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!configured()) throw fail(503, "Supabase is not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.");

  if (method === "GET" && pathname === "/api/session") {
    const session = readSession(req);
    if (!session) return sendJson(res, 200, { authenticated: false, csrf: "", username: "" });
    const cred = await credentials();
    if (session.v !== cred.version) return sendJson(res, 200, { authenticated: false, csrf: "", username: "" });
    return sendJson(res, 200, { authenticated: true, csrf: session.csrf, username: cred.username, optimizer: Boolean(sharpLib) });
  }

  if (method === "POST" && pathname === "/api/login") {
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    const attempt = attempts.get(ip) || { count: 0, startedAt: Date.now() };
    if (Date.now() - attempt.startedAt > 15 * 60 * 1000) { attempt.count = 0; attempt.startedAt = Date.now(); }
    if (attempt.count >= 8) return sendJson(res, 429, { error: "Too many attempts. Wait 15 minutes and try again." });
    const body = await readJson(req, 4096);
    const cred = await credentials();
    if (!verifyCredentials(cred, body.username, String(body.password || ""))) {
      attempt.count += 1; attempts.set(ip, attempt);
      await new Promise((r) => setTimeout(r, 400));
      return sendJson(res, 401, { error: "The Admin ID or password is not correct." });
    }
    attempts.delete(ip);
    return sendJson(res, 200, { authenticated: true }, { "Set-Cookie": sessionCookie(makeToken(crypto.randomBytes(24).toString("hex"), cred.version)) });
  }

  if (method === "POST" && pathname === "/api/logout") {
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
  }

  const session = readSession(req);
  const cred = session ? await credentials() : null;
  if (!session || session.v !== cred.version) return sendJson(res, 401, { error: "Please sign in to continue." });
  if (method !== "GET" && req.headers["x-csrf-token"] !== session.csrf) return sendJson(res, 403, { error: "This request could not be verified. Refresh and try again." });

  /* Every change: refresh the public copy (live on the website within seconds) and, in parallel, start the Vercel rebuild
     that refreshes the static pages search engines read. */
  const publish = async () => {
    const [, state] = await Promise.all([syncLive({ posts: defaultPosts(), settings: defaultSettings() }), triggerDeploy()]);
    return state === "failed" ? "Saved and live on the website. The search-engine copy could not be refreshed: check DEPLOY_HOOK_URL."
      : state === "not-configured" ? "Saved and live on the website. Add DEPLOY_HOOK_URL in Vercel so search engines get the update too."
      : "Saved. Live on the website now.";
  };

  if (method === "GET" && pathname === "/api/posts") return sendJson(res, 200, { posts: (await getOne("posts")) || defaultPosts() });
  if (method === "GET" && pathname === "/api/settings") return sendJson(res, 200, { settings: (await getOne("settings")) || defaultSettings() });

  if (method === "PUT" && pathname === "/api/settings") {
    const settings = validateSettings(await readJson(req));
    await setContent("settings", settings);
    return sendJson(res, 200, { settings, output: await publish() });
  }

  if (method === "POST" && pathname === "/api/account") {
    const body = await readJson(req, 4096);
    const current = String(body.currentPassword || "");
    if (!passwordOk(cred, current)) return sendJson(res, 400, { error: "The current password is not correct." });
    const nextUser = String(body.username ?? cred.username).trim();
    const nextPass = String(body.newPassword || "");
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(nextUser)) return sendJson(res, 400, { error: "Admin ID must be 3 to 32 characters: letters, numbers, dot, dash or underscore." });
    if (nextPass && nextPass.length < 8) return sendJson(res, 400, { error: "The new password must be at least 8 characters." });
    if (nextPass.length > 128) return sendJson(res, 400, { error: "The new password must be 128 characters or fewer." });
    if (nextPass && nextPass === current) return sendJson(res, 400, { error: "Choose a password different from the current one." });
    if (!nextPass && nextUser === cred.username) return sendJson(res, 400, { error: "Nothing to change. Enter a new Admin ID or a new password." });
    const salt = crypto.randomBytes(16);
    const updatedAt = new Date().toISOString();
    const saved = { username: nextUser, salt: salt.toString("hex"), hash: hashPassword(nextPass || current, salt).toString("hex"), updatedAt };
    await setContent("admin", saved);
    credCache = { at: Date.now(), value: { username: nextUser, saved, version: updatedAt } };
    // Other signed-in browsers are signed out (their session carries the old version); this one stays signed in.
    return sendJson(res, 200, { ok: true, username: nextUser }, { "Set-Cookie": sessionCookie(makeToken(session.csrf, updatedAt)) });
  }

  if (method === "POST" && pathname === "/api/upload") {
    const { bytes, extension } = await readImage(req, 1600);
    const file = `blog/cover-${crypto.randomUUID()}.${extension}`;
    return sendJson(res, 201, { cover: await uploadMedia(file, bytes, MIME[extension]) });
  }

  if (method === "GET" && pathname === "/api/gallery") {
    const gallery = (await getOne("gallery")) || [];
    return sendJson(res, 200, { images: gallery.map(({ name, url: u, thumb }) => ({ name, url: u, thumb: thumb || u })) });
  }

  if (method === "POST" && pathname === "/api/gallery") {
    const { bytes, extension } = await readImage(req, 1800);
    const name = `moment-${crypto.randomUUID().slice(0, 8)}.${extension}`;
    const file = `gallery/${name}`;
    const imageUrl = await uploadMedia(file, bytes, MIME[extension]);
    const small = await makeThumb(bytes);
    const thumbPath = small ? `gallery/thumb-${name.replace(/\.[a-z]+$/, "")}.webp` : "";
    const thumbUrl = small ? await uploadMedia(thumbPath, small, "image/webp") : "";
    const gallery = (await getOne("gallery")) || [];
    await setContent("gallery", [...gallery, { name, url: imageUrl, path: file, ...(small ? { thumb: thumbUrl, thumbPath } : {}) }]);
    return sendJson(res, 201, { name, url: imageUrl, output: url.searchParams.has("defer") ? "" : await publish() });
  }

  const galleryName = /^\/api\/gallery\/([^/]+)$/.exec(pathname)?.[1];
  if (method === "DELETE" && (galleryName || (pathname === "/api/gallery" && url.searchParams.get("name")))) {
    const name = galleryName ? decodeURIComponent(galleryName) : url.searchParams.get("name");
    const gallery = (await getOne("gallery")) || [];
    const item = gallery.find((g) => g.name === name);
    if (!item) return sendJson(res, 404, { error: "Image not found." });
    await setContent("gallery", gallery.filter((g) => g.name !== name));
    if (item.path) await deleteMedia(item.path);
    if (item.thumbPath) await deleteMedia(item.thumbPath);
    return sendJson(res, 200, { ok: true, output: await publish() });
  }

  if (method === "POST" && pathname === "/api/rebuild") return sendJson(res, 200, { output: await publish() });

  if (method === "GET" && pathname === "/api/hero") return sendJson(res, 200, { url: (await getOne("hero"))?.url || "/assets/gallery/dd61.webp" });

  if (method === "POST" && pathname === "/api/hero") {
    const { bytes, extension } = await readImage(req, 1400);
    const previous = (await getOne("hero"));
    const file = `hero/hero-${Date.now()}.${extension}`;
    const heroUrl = await uploadMedia(file, bytes, MIME[extension]);
    await setContent("hero", { url: heroUrl, path: file });
    if (previous?.path) await deleteMedia(previous.path);
    return sendJson(res, 201, { url: heroUrl, output: await publish() });
  }

  if (method === "DELETE" && pathname === "/api/hero") {
    const previous = await getOne("hero");
    await setContent("hero", {});
    if (previous?.path) await deleteMedia(previous.path);
    return sendJson(res, 200, { ok: true, url: "/assets/gallery/dd61.webp", output: await publish() });
  }

  if (method === "GET" && pathname === "/api/logo") return sendJson(res, 200, { url: (await getOne("logo"))?.url || "" });

  if (method === "POST" && pathname === "/api/logo") {
    const { bytes, extension } = await readImage(req, 512);
    const previous = await getOne("logo");
    const file = `logo/logo-${Date.now()}.${extension}`;
    const logoUrl = await uploadMedia(file, bytes, MIME[extension]);
    await setContent("logo", { url: logoUrl, path: file });
    if (previous?.path) await deleteMedia(previous.path);
    return sendJson(res, 201, { url: logoUrl, output: await publish() });
  }

  if (method === "DELETE" && pathname === "/api/logo") {
    const previous = await getOne("logo");
    await setContent("logo", {});
    if (previous?.path) await deleteMedia(previous.path);
    return sendJson(res, 200, { ok: true, output: await publish() });
  }

  if (method === "GET" && pathname === "/api/youtube-thumb") return sendJson(res, 200, { url: (await getOne("ytthumb"))?.url || "" });

  if (method === "POST" && pathname === "/api/youtube-thumb") {
    const { bytes, extension } = await readImage(req, 1280);
    const previous = (await getOne("ytthumb"));
    const file = `video/thumb-${Date.now()}.${extension}`;
    const thumbUrl = await uploadMedia(file, bytes, MIME[extension]);
    await setContent("ytthumb", { url: thumbUrl, path: file });
    if (previous?.path) await deleteMedia(previous.path);
    return sendJson(res, 201, { url: thumbUrl, output: await publish() });
  }

  if (method === "DELETE" && pathname === "/api/youtube-thumb") {
    const previous = (await getOne("ytthumb"));
    await setContent("ytthumb", {});
    if (previous?.path) await deleteMedia(previous.path);
    return sendJson(res, 200, { ok: true, output: await publish() });
  }

  if (method === "POST" && pathname === "/api/posts") {
    const posts = (await getOne("posts")) || defaultPosts();
    const post = validatePost(await readJson(req), posts);
    const next = [post, ...posts];
    await setContent("posts", next);
    return sendJson(res, 201, { post, posts: next, output: await publish() });
  }

  const postSlug = /^\/api\/posts\/([a-z0-9-]+)$/.exec(pathname)?.[1] || (pathname === "/api/posts" ? url.searchParams.get("slug") : null);
  if (postSlug && (method === "PUT" || method === "DELETE")) {
    const posts = (await getOne("posts")) || defaultPosts();
    const existing = posts.find((post) => post.slug === postSlug);
    if (!existing) return sendJson(res, 404, { error: "Post not found." });
    if (method === "DELETE") {
      const remaining = posts.filter((post) => post.slug !== existing.slug);
      await setContent("posts", remaining);
      await dropCoverIfUnused(existing.cover, remaining);
      return sendJson(res, 200, { ok: true, posts: remaining, output: await publish() });
    }
    const updated = validatePost(await readJson(req), posts, existing);
    const next = posts.map((post) => post.slug === existing.slug ? updated : post);
    await setContent("posts", next);
    if (existing.cover !== updated.cover) await dropCoverIfUnused(existing.cover, next);
    return sendJson(res, 200, { post: updated, posts: next, output: await publish() });
  }

  return sendJson(res, 404, { error: "API route not found." });
}

export default async function handler(req, res) {
  try {
    await route(req, res, new URL(req.url, "http://localhost"));
  } catch (error) {
    if (!res.headersSent) sendJson(res, error.status || 500, error.status ? { error: error.message } : { error: "The request could not be completed.", detail: String(error.message || error).slice(0, 200) });
    if (!error.status) console.error(error);
  }
}
