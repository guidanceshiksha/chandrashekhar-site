/* Local preview: `npm run dev`. Serves the built site from public/ on http://localhost:3000, rebuilds when a source file changes, and
   routes /api/* to the same handler Vercel runs, so the admin at /admin works locally too once the Supabase variables are in .env. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFile } from "node:child_process";
import handler from "./api/[...path].js";

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.resolve("public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };

let building = false, queued = false;
function build() {
  if (building) { queued = true; return; }
  building = true;
  execFile(process.execPath, ["build.mjs"], (error, stdout, stderr) => {
    building = false;
    console.log(error ? "Build failed:\n" + (stderr || error.message) : "Built: " + stdout.trim().split("\n").pop());
    if (queued) { queued = false; build(); }
  });
}

let timer;
for (const target of ["src", "admin", "server", "build.mjs", "api"]) {
  if (!fs.existsSync(target)) continue;
  fs.watch(target, { recursive: true }, (_, file) => {
    if (file && /siteSettings\.json$/.test(file)) return; // written by the build itself
    clearTimeout(timer);
    timer = setTimeout(build, 250);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    // Vercel routes only /api/<name> to the catch-all function; mirror that so a deeper path fails here too, not just in production.
    if (url.pathname.split("/").filter(Boolean).length > 2) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("NOT_FOUND (Vercel serves only /api/<name>)"); }
    return handler(req, res);
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/admin") rel = "/admin/index.html";
  if (rel.endsWith("/")) rel += "index.html";
  let file = path.join(PUBLIC, rel);
  // same as the vercel.json rewrite: an article newer than the last build is served by the fallback page
  if (!fs.existsSync(file) && rel.startsWith("/blog/") && rel.endsWith(".html") && rel.split("/").length === 3) file = path.join(PUBLIC, "blog", "post.html");
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}   Admin: http://localhost:${PORT}/admin`));

build();
