/* Static site build (runs on Vercel and locally). Output: public/. Nothing is rendered on request:
   every page is a plain file served from the CDN, and the JS/CSS bundles are hashed so browsers cache them for a year.
   With Supabase connected, content (posts, settings, gallery, hero, logo, thumbnail) comes from the database at build time. */
import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import { BLOG_POSTS } from "./src/blogData.mjs";
import { configured, getContent, getOne, supabaseUrl } from "./server/supabase.mjs";

const SITE = (process.env.SITE_URL || "https://prof-chandrashekhar.com").replace(/\/+$/, "");
const NAME = "Prof. Dr. Chandra Shekhar";
const IMG = /\.(jpe?g|png|webp)$/i;
const listDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);
const absolute = (u) => /^https?:\/\//i.test(u);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeCover = (value = "") => String(value).replace(/[\\"'()]/g, (c) => encodeURIComponent(c));
const inlineJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const jsonLd = (data) => `<script type="application/ld+json">${inlineJson(data)}</script>`;

/* ---------- content: Supabase when connected, repository files otherwise ---------- */
/* A failed fetch stops the build, so the live site is never replaced by stale content. */
const REMOTE = configured() ? await getContent() : {};
/* Live copy: pages read the newest content straight from Supabase with the public key, so admin changes show within seconds.
   Needs SUPABASE_PUBLISHABLE_KEY (the sb_publishable_... key, or the legacy anon key); without it pages use only the built data. */
const PUBLIC_KEY = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
const LIVE = configured() && PUBLIC_KEY ? { url: supabaseUrl(), key: PUBLIC_KEY, rev: (await getOne("public"))?.rev || "" } : null;
const LIVE_ORIGIN = LIVE ? new URL(LIVE.url).origin : "";
if (configured()) console.log("Content loaded from Supabase:", Object.keys(REMOTE).join(", ") || "(empty, using repository defaults)");
let SETTINGS = JSON.parse(fs.readFileSync("src/siteSettings.json", "utf8"));
if (REMOTE.settings) { SETTINGS = { ...SETTINGS, ...REMOTE.settings }; fs.writeFileSync("src/siteSettings.json", JSON.stringify(SETTINGS, null, 2) + "\n"); }
const posts = (Array.isArray(REMOTE.posts) ? REMOTE.posts : BLOG_POSTS).filter((p) => p.status !== "draft");

const localFile = (prefix) => listDir("assets").find((f) => new RegExp(`^${prefix}\\.(jpe?g|png|webp)$`, "i").test(f));
const localGallery = listDir("assets/gallery").filter((f) => IMG.test(f)).sort().map((f) => ({ name: f, url: `/assets/gallery/${encodeURIComponent(f)}` }));
const galleryItems = Array.isArray(REMOTE.gallery) ? REMOTE.gallery : localGallery;
const DEFAULT_PHOTO = "/assets/gallery/dd61.webp";
const heroLocal = localFile("hero");
const photoPath = REMOTE.hero?.url || (heroLocal ? `/assets/${heroLocal}` : DEFAULT_PHOTO);
const logoLocal = localFile("logo");
const logoUrl = REMOTE.logo?.url || (logoLocal ? `/assets/${logoLocal}` : "");
const thumbLocal = localFile("yt-thumb");
let thumbUrl = REMOTE.ytthumb?.url || (thumbLocal ? `/assets/${thumbLocal}` : "");
if (!thumbUrl) {
  const g = galleryItems.find((x) => /off\s*beat.*(carrer|career)|off\s*beat.*thumb/i.test(x.name));
  if (g) thumbUrl = g.url;
}
const shareImageUrl = absolute(photoPath) ? photoPath : SITE + photoPath;

/* ---------- output folder ---------- */
fs.rmSync("public", { recursive: true, force: true });
fs.mkdirSync("public/assets", { recursive: true });
for (const f of listDir("assets")) if (/^(hero|logo|yt-thumb)\.(jpe?g|png|webp)$/i.test(f)) fs.cpSync("assets/" + f, "public/assets/" + f);
if (fs.existsSync("assets/blog")) fs.cpSync("assets/blog", "public/assets/blog", { recursive: true });
if (Array.isArray(REMOTE.gallery)) { // photos live in Supabase; keep only the default portrait
  fs.mkdirSync("public/assets/gallery", { recursive: true });
  if (fs.existsSync("assets/gallery/dd61.webp")) fs.cpSync("assets/gallery/dd61.webp", "public/assets/gallery/dd61.webp");
} else if (fs.existsSync("assets/gallery")) fs.cpSync("assets/gallery", "public/assets/gallery", { recursive: true });
fs.cpSync("admin", "public/admin", { recursive: true }); // the dashboard; it only works once Supabase and the admin variables are set

/* ---------- JS + CSS bundle (hashed file names => cached for a year, HTML stays tiny) ---------- */
const bundle = await esbuild.build({
  entryPoints: ["src/main.jsx", "src/pages.js"], bundle: true, minify: true, format: "iife", jsx: "automatic", loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": '"production"' }, outdir: "public/assets", entryNames: "[name]-[hash]", metafile: true, logLevel: "error",
});
const outputs = Object.keys(bundle.metafile.outputs).map((f) => path.basename(f));
const JS_FILE = outputs.find((f) => /^main-.*\.js$/.test(f));
const CSS_FILE = outputs.find((f) => /^main-.*\.css$/.test(f));
const PAGES_FILE = outputs.find((f) => /^pages-.*\.js$/.test(f));

/* ---------- shared page pieces ---------- */
const FONTS = "https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";
const DEFAULT_ICON = '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2714%27 fill=%27%230a0a0a%27/%3E%3Ctext x=%2732%27 y=%2742%27 font-family=%27Georgia,serif%27 font-size=%2728%27 text-anchor=%27middle%27 fill=%27%23fff%27%3ECS%3C/text%3E%3C/svg%3E">';
const FAVICON = logoUrl ? `<link rel="icon" href="${escapeHtml(logoUrl)}">` : DEFAULT_ICON;
const headCommon = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${FAVICON}
<meta name="theme-color" content="#0a0a0a">
<meta name="author" content="${NAME}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/assets/${CSS_FILE}">`;
const innerCsp = (img) => `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src ${img}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; connect-src 'self'${LIVE_ORIGIN ? " " + LIVE_ORIGIN : ""}; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self' https://wa.me; upgrade-insecure-requests;">`;
const PAGE_BASE = "body { margin: 0; background: #ffffff; color: #0a0a0a; }";
const liveData = LIVE ? `<script>window.__SB__=${inlineJson(LIVE)};</script>` : "";
const pageScripts = LIVE ? `${liveData}\n<script src="/assets/${PAGES_FILE}" defer></script>` : "";
const BACK_LINK = "display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 12px 18px; border-radius: 999px; border: 1px solid rgba(0,0,0,.15); background: #fff; font-weight: 600;";

/* ---------- home page ---------- */
const personLd = {
  "@context": "https://schema.org", "@type": "Person", name: NAME, jobTitle: "Professor & In-Charge (Admissions)", url: SITE + "/", image: shareImageUrl,
  email: SETTINGS.email || undefined, telephone: SETTINGS.phones[0] || undefined,
  worksFor: { "@type": "CollegeOrUniversity", name: "Bharatiya Vidya Bhavan College, GGSIP University, Delhi" }, sameAs: SETTINGS.socials.map((x) => x.url),
};
const previewPosts = posts.slice(0, 3).map(({ slug, title, category, date, excerpt, cover, content }) => ({
  slug, title, category, date, excerpt, cover, readMin: Math.max(1, Math.ceil((content || []).join(" ").split(/\s+/).filter(Boolean).length / 200)),
}));
const pageData = {
  __PHOTO__: photoPath, __GALLERY__: galleryItems.map((g) => g.url), __GALLERY_THUMBS__: galleryItems.map((g) => g.thumb || g.url), __POSTS__: previewPosts, __SITE__: SITE,
  ...(thumbUrl ? { __OFF_BEAT_THUMBNAIL__: thumbUrl } : {}), ...(logoUrl ? { __LOGO__: logoUrl } : {}),
};
const dataScript = `<script>Object.assign(window, ${inlineJson(pageData)});</script>${liveData}`;

const home = `<!doctype html>
<html lang="en">
<head>
${headCommon}
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<meta name="description" content="${escapeHtml(SETTINGS.metaDescription)}">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/">
<meta property="og:title" content="${NAME} | Education Advisor & Researcher">
<meta property="og:description" content="Academic leader, education advisor, researcher and mentor helping students and institutions with admissions, careers and higher education guidance.">
<meta property="og:site_name" content="${NAME}">
<meta property="og:image" content="${escapeHtml(shareImageUrl)}">
<meta property="og:image:alt" content="Portrait of ${NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(SETTINGS.siteTitle)}">
<meta name="twitter:description" content="${escapeHtml(SETTINGS.metaDescription)}">
<meta name="twitter:image" content="${escapeHtml(shareImageUrl)}">
${innerCsp("'self' data: https:" + (LIVE_ORIGIN ? " " + LIVE_ORIGIN : ""))}
<title>${escapeHtml(SETTINGS.siteTitle)}</title>
${jsonLd(personLd)}
<link rel="preload" as="image" href="${escapeHtml(photoPath)}" fetchpriority="high">
</head>
<body>
<div id="root"></div>
${dataScript}
<script src="/assets/${JS_FILE}" defer></script>
</body>
</html>
`;

/* ---------- gallery page ---------- */
const galleryPage = `<!doctype html>
<html lang="en">
<head>
${headCommon}
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="description" content="Gallery of ${NAME} featuring moments, awards, media appearances and student interactions.">
<link rel="canonical" href="${SITE}/gallery.html">
<meta property="og:type" content="website">
<meta property="og:title" content="Gallery | ${NAME}">
<meta property="og:description" content="Moments, awards and media highlights from the life and work of ${NAME}.">
<meta property="og:image" content="${escapeHtml(shareImageUrl)}">
<meta property="og:image:alt" content="Photo gallery of ${NAME}">
<meta name="twitter:card" content="summary_large_image">
${innerCsp("'self' data: https:" + (LIVE_ORIGIN ? " " + LIVE_ORIGIN : ""))}
<title>Gallery | ${NAME}</title>
<style>
  ${PAGE_BASE}
  .gallery-page { max-width: 1200px; margin: 0 auto; padding: 48px 20px 80px; }
  .gallery-page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
  .gallery-page-header h1 { font-family: "Young Serif", Georgia, serif; font-size: clamp(32px, 5vw, 60px); margin: 0; }
  .gallery-page-header a { ${BACK_LINK} }
  .gallery-page-grid { columns: 4 220px; column-gap: 16px; }
  .gallery-page-grid img { display: block; width: 100%; height: auto; border-radius: 18px; margin: 0 0 16px; break-inside: avoid; box-shadow: 0 15px 24px -22px rgba(0,0,0,.45); }
  @media (max-width: 720px) { .gallery-page-header { flex-direction: column; align-items: flex-start; } }
</style>
</head>
<body data-page="gallery">
  <div class="gallery-page">
    <div class="gallery-page-header"><h1>Moments</h1><a href="/">Back to home</a></div>
    <div class="gallery-page-grid">
${galleryItems.map((g, i) => `      <img src="${escapeHtml(g.thumb || g.url)}" alt="Moment ${i + 1} - ${NAME}" loading="lazy" decoding="async">`).join("\n")}
    </div>
  </div>
${pageScripts}
</body>
</html>
`;

/* ---------- blog ---------- */
const coverStyle = (cover, a, b) => `background-image: linear-gradient(180deg, rgba(0,0,0,${a}), rgba(0,0,0,${b})), url('${safeCover(cover)}');`;
const blogIndex = `<!doctype html>
<html lang="en">
<head>
${headCommon}
<meta name="description" content="Blog insights on education, research, admissions and career guidance by ${NAME}.">
<link rel="canonical" href="${SITE}/blog/">
<meta property="og:image" content="${escapeHtml(shareImageUrl)}">
<meta property="og:image:alt" content="${NAME} blog cover">
${innerCsp("'self' data: https:" + (LIVE_ORIGIN ? " " + LIVE_ORIGIN : ""))}
<title>Blog | ${NAME}</title>
<style>
  ${PAGE_BASE}
  .blog-page { max-width: 1180px; margin: 0 auto; padding: 48px 20px 80px; }
  .blog-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 28px; }
  .blog-header h1 { font-family: "Young Serif", Georgia, serif; font-size: clamp(38px, 7vw, 78px); margin: 0; }
  .blog-header a { ${BACK_LINK} }
  .blog-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
  .blog-item { background: #fff; border: 1px solid rgba(0,0,0,.15); border-radius: 22px; overflow: hidden; }
  .blog-item-cover { min-height: 200px; background-size: cover; background-position: center; }
  .blog-item-body { padding: 22px; }
  .blog-item-body .meta { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #526079; }
  .blog-item-body h2 { font-family: "Young Serif", Georgia, serif; font-size: clamp(24px, 3vw, 32px); margin: 14px 0 12px; }
  .blog-item-body p { color: #526079; margin: 0 0 18px; }
  .blog-item-body a { display: inline-flex; align-items: center; gap: 8px; color: #0a0a0a; text-decoration: none; font-weight: 600; }
  @media (max-width: 900px) { .blog-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .blog-header { flex-direction: column; align-items: flex-start; } .blog-list { grid-template-columns: minmax(0, 1fr); } }
</style>
</head>
<body data-page="blog">
  <div class="blog-page">
    <div class="blog-header"><h1>Blog</h1><a href="/">Back to home</a></div>
    <div class="blog-list">
${posts.map((post) => `      <article class="blog-item">
        <div class="blog-item-cover" style="${coverStyle(post.cover, 0.1, 0.35)}"></div>
        <div class="blog-item-body">
          <div class="meta"><span>${escapeHtml(post.category)}</span><span>${escapeHtml(post.date)}</span></div>
          <h2>${escapeHtml(post.title)}</h2>
          <p>${escapeHtml(post.excerpt)}</p>
          <a href="${post.slug}.html">Read article →</a>
        </div>
      </article>`).join("\n")}
    </div>
  </div>
${pageScripts}
</body>
</html>
`;

fs.mkdirSync("public/blog", { recursive: true });
fs.writeFileSync("public/blog/index.html", blogIndex);
const articlePage = (post) => {
  const title = escapeHtml(post.seoTitle || post.title);
  const description = escapeHtml(post.seoDescription || post.excerpt);
  const url = `${SITE}/blog/${post.slug}.html`;
  const cover = post.cover || shareImageUrl;
  const postLd = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.seoDescription || post.excerpt, image: cover,
    datePublished: post.createdAt || undefined, dateModified: post.updatedAt || post.createdAt || undefined, mainEntityOfPage: url, keywords: post.keywords || undefined,
    author: { "@type": "Person", name: NAME, url: SITE + "/" }, publisher: { "@type": "Person", name: NAME },
  };
  return `<!doctype html>
<html lang="en">
<head>
${headCommon}
<meta name="description" content="${description}">
${post.keywords ? `<meta name="keywords" content="${escapeHtml(post.keywords)}">\n` : ""}<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${escapeHtml(cover)}">
<meta property="og:image:alt" content="${escapeHtml(post.coverAlt || post.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${escapeHtml(cover)}">
${innerCsp("'self' data: https:" + (LIVE_ORIGIN ? " " + LIVE_ORIGIN : ""))}
<title>${title} | ${NAME}</title>
${jsonLd(postLd)}
<style>
  ${PAGE_BASE}
  .post-shell { max-width: 860px; margin: 0 auto; padding: 48px 20px 80px; }
  .post-cover { min-height: 320px; border-radius: 24px; background-size: cover; background-position: center; margin-bottom: 28px; }
  .post-meta { display: flex; gap: 14px; flex-wrap: wrap; font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #526079; }
  .post-shell h1 { font-family: "Young Serif", Georgia, serif; font-size: clamp(32px, 5vw, 58px); line-height: 1.05; margin: 18px 0; }
  .post-body { font-size: 18px; line-height: 1.8; color: #0a0a0a; }
  .post-body p { margin: 0 0 1.4em; }
  .post-back { ${BACK_LINK} margin-top: 24px; }
</style>
</head>
<body data-page="post" data-slug="${escapeHtml(post.slug)}" data-updated="${escapeHtml(post.updatedAt || "")}">
  <div class="post-shell">
    <div class="post-cover" role="img" aria-label="${escapeHtml(post.coverAlt || post.title)}" style="${coverStyle(post.cover, 0.15, 0.35)}"></div>
    <div class="post-meta"><span>${escapeHtml(post.category)}</span><span>${escapeHtml(post.date)}</span></div>
    <h1>${escapeHtml(post.title)}</h1>
    <div class="post-body">
      ${post.content.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("")}
    </div>
    <a class="post-back" href="/blog/">← Back to blog</a>
  </div>
${pageScripts}
</body>
</html>
`;
};
for (const post of posts) fs.writeFileSync(`public/blog/${post.slug}.html`, articlePage(post));
/* Served by vercel.json for /blog/<slug>.html when no file exists yet (an article published after the last build):
   it loads the article from the live copy. Not indexed; the next build writes the real page. */
fs.writeFileSync("public/blog/post.html", articlePage({ slug: "", title: "Loading article…", category: "", date: "", excerpt: "", cover: "", content: [], updatedAt: "" })
  .replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex">')
  .replace(/<link rel="canonical"[^>]*>\n/, ""));

/* ---------- sitemap + robots ---------- */
const today = new Date().toISOString().slice(0, 10);
const urlEntry = (loc, lastmod) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
fs.writeFileSync("public/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
  urlEntry(SITE + "/", today), urlEntry(SITE + "/gallery.html", today), urlEntry(SITE + "/blog/", today),
  ...posts.map((p) => urlEntry(`${SITE}/blog/${p.slug}.html`, String(p.updatedAt || p.createdAt || today).slice(0, 10))),
].join("\n")}\n</urlset>\n`);
fs.writeFileSync("public/robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync("public/index.html", home);
fs.writeFileSync("public/gallery.html", galleryPage);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + " KB";
console.log(`public/index.html ${kb(home)} | ${JS_FILE} ${(fs.statSync("public/assets/" + JS_FILE).size / 1024).toFixed(0)} KB | ${CSS_FILE} ${(fs.statSync("public/assets/" + CSS_FILE).size / 1024).toFixed(0)} KB | ${posts.length} posts, ${galleryItems.length} photos`);
