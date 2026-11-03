/* Live refresh for the static pages (blog list, article, gallery). The HTML from the build is shown at once;
   if the admin changed something since that build, the page updates itself from the public copy in Supabase. */
import { loadPost, loadPublic } from "./live.js";

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const bg = (url, a, b) => `linear-gradient(180deg, rgba(0,0,0,${a}), rgba(0,0,0,${b})), url("${String(url || "").replace(/["'()\\\s]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())}")`;
const NAME = "Prof. Dr. Chandra Shekhar";

function blogList(posts) {
  const list = document.querySelector(".blog-list");
  if (!list) return;
  list.replaceChildren(...posts.map((p) => {
    const card = h("article", "blog-item");
    const cover = h("div", "blog-item-cover"); cover.style.backgroundImage = bg(p.cover, 0.1, 0.35);
    const body = h("div", "blog-item-body");
    const meta = h("div", "meta"); meta.append(h("span", null, p.category), h("span", null, p.date));
    const link = h("a", null, "Read article →"); link.href = encodeURIComponent(p.slug) + ".html";
    body.append(meta, h("h2", null, p.title), h("p", null, p.excerpt), link);
    card.append(cover, body);
    return card;
  }));
}

function articleMissing() {
  const shell = document.querySelector(".post-shell");
  const back = h("a", "post-back", "← Back to blog"); back.href = "/blog/";
  shell.replaceChildren(h("h1", null, "This article is not available"), h("p", "post-meta", "It may have been removed or moved."), back);
  document.title = "Article not found | " + NAME;
}

function article(p) {
  const cover = document.querySelector(".post-cover");
  cover.style.backgroundImage = bg(p.cover, 0.15, 0.35);
  cover.setAttribute("aria-label", p.coverAlt || p.title);
  const meta = document.querySelector(".post-meta"); meta.replaceChildren(h("span", null, p.category), h("span", null, p.date));
  document.querySelector(".post-shell h1").textContent = p.title;
  const body = document.querySelector(".post-body");
  body.replaceChildren(...(p.content || []).map((para) => {
    const el = h("p");
    String(para).split("\n").forEach((line, i) => { if (i) el.append(h("br")); el.append(document.createTextNode(line)); });
    return el;
  }));
  document.title = (p.seoTitle || p.title) + " | " + NAME;
  document.body.dataset.updated = p.updatedAt || "";
}

function galleryGrid(items) {
  const grid = document.querySelector(".gallery-page-grid");
  if (!grid) return;
  grid.replaceChildren(...items.map((g, i) => { const img = h("img"); img.src = g.thumb || g.url; img.alt = `Moment ${i + 1} - ${NAME}`; img.loading = "lazy"; img.decoding = "async"; return img; }));
}

async function run() {
  const page = document.body.dataset.page;
  if (page === "blog" || page === "gallery") {
    const v = await loadPublic();
    if (v) page === "blog" ? blogList(v.posts || []) : galleryGrid(v.gallery || []);
    return;
  }
  if (page === "post") {
    const built = document.body.dataset.slug; // empty on the fallback page used for articles published after the last build
    const slug = built || decodeURIComponent(location.pathname.split("/").pop().replace(/\.html$/, ""));
    const p = await loadPost(slug);
    if (p === undefined) { if (!built) articleMissing(); return; } // live copy not set up: keep the built page
    if (p === null) return articleMissing();
    if (!built || p.updatedAt !== document.body.dataset.updated) article(p);
    document.body.classList.remove("is-loading");
  }
}

run().catch(() => {
  if (document.body.dataset.page === "post" && !document.body.dataset.slug) articleMissing();
});
