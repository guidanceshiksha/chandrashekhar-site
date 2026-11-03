/* Reads the public copy of the site content from Supabase (rows "public" and "post:<slug>"), so changes made in the admin
   show within seconds instead of after the next Vercel rebuild. Shared by the home page (React) and the static pages. */
const SB = typeof window !== "undefined" ? window.__SB__ : null;

async function rows(filter) {
  if (!SB?.url || !SB?.key) return null;
  const headers = { apikey: SB.key };
  if (SB.key.startsWith("eyJ")) headers.Authorization = "Bearer " + SB.key; // legacy anon key
  const res = await fetch(`${SB.url}/rest/v1/site_content?select=value&${filter}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error("live " + res.status);
  return res.json();
}

/* The newest site summary, or null when it is the one this page was built with (nothing to update). */
export async function loadPublic() {
  const r = await rows("key=eq.public");
  const v = r?.[0]?.value;
  return v && v.rev !== SB.rev ? v : null;
}

/* One published article; null when it no longer exists or is a draft; undefined when live data is unavailable. */
export async function loadPost(slug) {
  const r = await rows("key=eq." + encodeURIComponent("post:" + slug));
  if (r === null) return undefined;
  return r[0]?.value ?? null;
}

export const liveEnabled = () => Boolean(SB?.url && SB?.key);
