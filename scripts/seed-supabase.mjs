/* One-time copy of the content in this repository into Supabase (posts, settings, gallery, hero, YouTube thumbnail).
   Run after creating the table with supabase/schema.sql:   npm run seed:supabase
   Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (put them in a local .env file, never commit it). Existing rows are kept unless --force. */
import fs from "node:fs";
import path from "node:path";
import { BLOG_POSTS } from "../src/blogData.mjs";
import sharp from "sharp";
import { configured, getContent, getOne, publicUrl, setContent, uploadMedia } from "../server/supabase.mjs";
import { syncLive } from "../server/live.mjs";

if (!configured()) { console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (see .env.example)."); process.exit(1); }
const force = process.argv.includes("--force");
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const isImage = (f) => /\.(jpe?g|png|webp)$/i.test(f);
const mime = (f) => MIME[path.extname(f).toLowerCase()];

let existing;
try { existing = await getContent(); }
catch (error) { console.error(error.message + "\nHave you run supabase/schema.sql in the Supabase SQL Editor?"); process.exit(1); }
const want = (key) => force || existing[key] === undefined;

if (want("settings")) {
  await setContent("settings", JSON.parse(fs.readFileSync("src/siteSettings.json", "utf8")));
  console.log("settings: saved");
}

/* Gallery: local photos first, then any photo already added from the dashboard (never lost, never duplicated). */
if (want("gallery") || (existing.gallery || []).length < 2) {
  const dir = "assets/gallery";
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(isImage).sort() : [];
  const gallery = [];
  for (const name of names) {
    const file = `gallery/${name}`;
    gallery.push({ name, url: await uploadMedia(file, fs.readFileSync(path.join(dir, name)), mime(name)), path: file });
    process.stdout.write(`gallery: ${gallery.length}/${names.length}\r`);
  }
  const own = new Set(gallery.map((g) => g.name));
  const added = (force ? [] : existing.gallery || []).filter((g) => !own.has(g.name));
  await setContent("gallery", [...gallery, ...added]);
  console.log(`gallery: ${gallery.length} photos uploaded, ${added.length} kept from the dashboard`);
}

for (const [key, prefix, folder] of [["hero", "hero", "hero"], ["ytthumb", "yt-thumb", "video"]]) {
  if (!want(key)) continue;
  const local = fs.existsSync("assets") ? fs.readdirSync("assets").find((f) => new RegExp(`^${prefix}\\.(jpe?g|png|webp)$`, "i").test(f)) : null;
  if (!local) { console.log(`${key}: no local file, skipped`); continue; }
  const file = `${folder}/${prefix}-${Date.now()}${path.extname(local).toLowerCase()}`;
  await setContent(key, { url: await uploadMedia(file, fs.readFileSync(path.join("assets", local)), mime(local)), path: file });
  console.log(`${key}: uploaded`);
}

/* Thumbnails: every gallery photo gets a 640 px WebP copy for the website grid (only missing ones are created, so this is safe to repeat). */
{
  const gallery = (await getOne("gallery")) || [];
  let made = 0;
  for (const item of gallery) {
    if (item.thumb) continue;
    try {
      const bytes = Buffer.from(await (await fetch(item.url)).arrayBuffer());
      const small = await sharp(bytes).rotate().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      item.thumbPath = "gallery/thumb-" + item.name.replace(/\.[A-Za-z0-9]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-") + ".webp";
      item.thumb = await uploadMedia(item.thumbPath, small, "image/webp");
      made++;
      process.stdout.write("thumbnails: " + made + "\r");
    } catch (error) { console.log("\nthumbnail skipped for " + item.name + ": " + error.message); }
  }
  if (made) { await setContent("gallery", gallery); console.log("thumbnails: " + made + " created"); }
}

if (want("posts")) {
  const posts = [];
  for (const post of BLOG_POSTS) {
    let cover = post.cover || "";
    const localCover = cover.startsWith("/assets/blog/") ? path.join("assets", "blog", cover.slice("/assets/blog/".length)) : null;
    if (localCover && fs.existsSync(localCover)) {
      const file = `blog/${path.basename(localCover)}`;
      cover = await uploadMedia(file, fs.readFileSync(localCover), mime(localCover));
    }
    posts.push({ status: "published", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...post, cover });
  }
  await setContent("posts", posts);
  console.log(`posts: ${posts.length} saved`);
}

await syncLive();
console.log("public copy: refreshed (instant publishing)");
console.log("Done. Public photo base:", publicUrl("gallery/").replace(/\/$/, ""));
