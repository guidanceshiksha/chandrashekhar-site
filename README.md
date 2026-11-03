# Prof. Dr. Chandra Shekhar: website

Static portfolio and blog (React bundled at build time) with a dashboard at `/admin` backed by Supabase. Hosted on Vercel.

| Path | What it is |
| --- | --- |
| `src/` | The website: `main.jsx` (page), `styles.css` + `theme.css` (design), `blogData.mjs` + `siteSettings.json` (default content) |
| `build.mjs` | Static build into `public/` (hashed JS/CSS, blog pages, gallery, sitemap, robots) |
| `api/[...path].js` | Admin API (Vercel serverless function; only the dashboard calls it) |
| `admin/` | The dashboard (plain HTML/JS) |
| `server/supabase.mjs` | Small Supabase client used by the API, the build and the seed script |
| `supabase/schema.sql` | Run once in the Supabase SQL Editor |
| `scripts/` | `generate-admin.mjs` (ID/password for Vercel), `seed-supabase.mjs` (one-time content copy) |

Commands: `npm run dev` (preview at localhost:3000), `npm run build`, `npm run admin:credentials`, `npm run seed:supabase`.

Hosting and setup: see [DEPLOYMENT.md](DEPLOYMENT.md). Variables: see [.env.example](.env.example).
