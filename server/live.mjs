/* Public copy of the site content, read by visitors' browsers so a change in the admin shows on the website within seconds,
   without waiting for the Vercel rebuild (which still runs afterwards so the static pages stay correct for search engines).
   Rows: "public" (settings, photos, post list without the article text) and "post:<slug>" (one published article each).
   Supabase only lets the public key read these rows (see supabase/schema.sql); drafts and the admin row stay private. */
import { deleteKeys, getContent, listKeys, setMany } from "./supabase.mjs";

const DEFAULT_PHOTO = "/assets/gallery/dd61.webp";
const readMin = (content) => Math.max(1, Math.ceil((content || []).join(" ").split(/\s+/).filter(Boolean).length / 200));

export function publicView(content, fallback = {}) {
  const posts = (Array.isArray(content.posts) ? content.posts : fallback.posts || []).filter((p) => p.status !== "draft");
  const gallery = (Array.isArray(content.gallery) ? content.gallery : []).map(({ name, url, thumb }) => ({ name, url, thumb: thumb || url }));
  const offBeat = gallery.find((g) => /off\s*beat.*(carrer|career)|off\s*beat.*thumb/i.test(g.name));
  return {
    rev: Date.now().toString(36),
    settings: content.settings || fallback.settings || null,
    hero: content.hero?.url || DEFAULT_PHOTO,
    logo: content.logo?.url || "",
    thumb: content.ytthumb?.url || offBeat?.url || "",
    gallery,
    posts: posts.map(({ slug, title, category, date, excerpt, cover, coverAlt, content: body, updatedAt }) => ({ slug, title, category, date, excerpt, cover, coverAlt, updatedAt, readMin: readMin(body) })),
    articles: posts,
  };
}

/* Rewrites the public rows from the current content. Four small requests at most. */
export async function syncLive(fallback = {}) {
  const view = publicView(await getContent(), fallback);
  const { articles, ...summary } = view;
  const wanted = new Set(articles.map((p) => "post:" + p.slug));
  await setMany([["public", summary], ...articles.map((p) => ["post:" + p.slug, p])]);
  const stale = (await listKeys("post:")).filter((k) => !wanted.has(k));
  await deleteKeys(stale);
  return summary.rev;
}
