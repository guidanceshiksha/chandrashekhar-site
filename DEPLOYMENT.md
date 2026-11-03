# Deploying on Vercel with Supabase: step by step

How it works: the public website is plain static files served from Vercel's CDN. Nothing is rendered per visit and no server runs for visitors.
The admin (`/admin`) saves posts, settings and photos in Supabase and also writes a small public copy. Pages read that copy, so a change is visible within seconds.
In the background Vercel rebuilds the static pages (about a minute) so search engines get the update too.

## 1. Supabase (database + photos)

1. Go to supabase.com, sign in, **New project**. Name `prof-chandrashekhar`, generate and save the database password, region **South Asia (Mumbai)**, Free plan.
2. Wait about 2 minutes. Open **SQL Editor > New query**, paste the whole of `supabase/schema.sql`, press **Run**.
   This creates the `site_content` table (the public key can read only the published copy, never drafts or the admin login) and the public `media` storage bucket.
3. Open **Project Settings > Data API** and copy the **Project URL** (`https://xxxx.supabase.co`).
4. Open **Project Settings > API Keys > Secret keys**, reveal the `default` key (`sb_secret_...`) and copy it. This key is private.
5. On the same page copy the **Publishable key** (`sb_publishable_...`). It is meant to be public and can only read the published copy.

## 2. Admin ID and password

Run `npm run admin:credentials` on your computer. It prints an Admin ID, a password and a session secret. Copy all three (nothing is stored).
You can change the Admin ID and password later in the dashboard under **Account**.

## 3. Vercel project

1. Push this repository to GitHub, then in Vercel choose **Add New > Project** and import it.
2. Framework Preset **Other**. Build command `npm run build`, output directory `public` (already set by `vercel.json`). Do not deploy yet.
3. **Settings > Git > Deploy Hooks**: name `admin-publish`, branch `main`, **Create**, copy the URL.
4. **Settings > Environment Variables** (Production):

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Project URL from step 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | the `sb_secret_...` key from step 1.4 |
| `SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_...` key from step 1.5 (instant publishing) |
| `ADMIN_USERNAME` | from step 2 |
| `ADMIN_PASSWORD` | from step 2 |
| `SESSION_SECRET` | from step 2 |
| `DEPLOY_HOOK_URL` | the hook URL from step 3.3 |
| `SITE_URL` | `https://www.prof-chandrashekhar.com` (your real address) |

5. **Deploy**. Add your domain under **Settings > Domains**.

## 4. Copy the existing content into Supabase (once)

1. Create a file named `.env` in the project folder with two lines (real values, no quotes):
   `SUPABASE_URL=...` and `SUPABASE_SERVICE_ROLE_KEY=...`
2. Run `npm run seed:supabase`. It uploads the gallery photos (and a small copy of each), the blog posts and the settings.
3. In Vercel, **Deployments > latest > Redeploy**. Delete the `.env` file afterwards if you like.

## 5. Use it

Open `https://your-domain/admin`, sign in with the Admin ID and password. Posts, photos, hero, logo, YouTube thumbnail and settings are all managed there.
Every uploaded image is converted to WebP automatically (transparency is kept for logos). A save is visible on the website within seconds; it also triggers one Vercel rebuild for search engines (the photo uploader does this once per batch).

Already set up before instant publishing existed? Run `supabase/schema.sql` again (safe to repeat), add `SUPABASE_PUBLISHABLE_KEY` in Vercel, run `npm run seed:supabase` once (it refreshes the public copy) and redeploy.

## Limits to keep in mind (free plans)

- Vercel Hobby allows 100 deployments per day. Each save in the admin is one deployment, so batch your edits.
- Supabase free storage is 1 GB and 5 GB of traffic per month. Photos are shrunk to WebP and the gallery grid uses small copies, so this lasts a long time.
- Uploads are limited to about 3 MB after the browser shrinks them (a Vercel request limit); large photos are shrunk automatically.

## Troubleshooting

- Build fails with `ENOTFOUND` or `ERR_INVALID_URL`: `SUPABASE_URL` is wrong. It must be `https://<project-id>.supabase.co`.
- Build fails with `relation "site_content" does not exist`: run `supabase/schema.sql` (step 1.2).
- Admin says "Supabase is not connected": `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing in Vercel; add it and redeploy.
- Change saved but site not updated: check `DEPLOY_HOOK_URL`, then look at Vercel > Deployments for a failed build.
- Local preview: `npm run dev` (http://localhost:3000, admin at /admin once `.env` is filled).
