const $ = (s, r = document) => r.querySelector(s);
const loginView = $("#login-view");
const app = $("#app");
const view = $("#view");
let csrf = "";
let posts = [];
let toastTimer = 0;

const MAX_BYTES = 3 * 1024 * 1024; // the online admin accepts at most 4.5 MB per request (base64 adds a third)
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slugify = (v) => v.normalize("NFKD").toLowerCase().replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
/* While typing, keep hyphens (a trailing "-" is the user's next character); the full cleanup runs when the field loses focus and on save. */
const slugLive = (v) => v.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-/, "").slice(0, 80);
const today = () => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());

async function api(url, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.mutate ? { "X-CSRF-Token": csrf } : {}) };
  let res;
  try { res = await fetch(url, { ...options, headers, credentials: "same-origin" }); }
  catch { throw new Error("Could not reach the server. Check your internet connection and try again."); }
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* not JSON: a platform error page */ }
  if (!res.ok) {
    if (data.error) throw new Error(data.detail ? `${data.error} (${data.detail})` : data.error);
    const page = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
    throw new Error(`The server returned an error (${res.status})${page ? ": " + page : ""}. Check the Vercel function logs.`);
  }
  return data;
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

/* Prepares an image for upload. Anything that is not already a small WebP is shrunk (longest side `maxDim`) and converted to
   WebP in the browser, keeping transparency, so uploads stay small. The server converts to WebP again as a safety net. */
function readFile(file, maxDim = 1800) {
  const toDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(blob);
  });
  const encode = (canvas, type, quality) => new Promise((res) => canvas.toBlob(res, type, quality));
  return (async () => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: only JPEG, PNG or WebP images are allowed.`);
    if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: images must be 25 MB or smaller.`);
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch { bitmap = null; }
    const needsWork = bitmap && (file.type !== "image/webp" || Math.max(bitmap.width, bitmap.height) > maxDim || file.size > 1.2 * 1024 * 1024);
    if (!needsWork) {
      if (file.size > MAX_BYTES) throw new Error(`${file.name}: this image is too large. Try a smaller photo.`);
      return toDataUrl(file);
    }
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await encode(canvas, "image/webp", 0.85);
    if (!blob || blob.type !== "image/webp") { // very old browsers cannot write WebP: fall back to JPEG on white
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      blob = await encode(canvas, "image/jpeg", 0.86);
    }
    if (!blob) throw new Error(`${file.name}: could not process the image.`);
    const best = blob.size < file.size || file.size > MAX_BYTES ? blob : file;
    if (best.size > MAX_BYTES) throw new Error(`${file.name}: image is still too large after shrinking. Try a smaller photo.`);
    return toDataUrl(best);
  })();
}

const UPLOAD_HINT = "JPEG, PNG or WebP up to 25 MB. Large images are shrunk and converted to WebP automatically.";

function head(title, sub, actions = "") {
  return `<div class="a-top"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div><div class="acts">${actions}</div></div>`;
}

/* ---------- views ---------- */
async function dashboard() {
  let images = [], optimizer = true;
  try { images = (await api("/api/gallery")).images; } catch {}
  try { optimizer = (await api("/api/session")).optimizer !== false; } catch {}
  const pub = posts.filter((p) => p.status !== "draft").length;
  view.innerHTML = head("Dashboard", "Manage the blog, moments and hero photo of the website.") +
    `<div class="stats">
      <a class="stat" href="#/blog"><b>${posts.length}</b><span>Blog posts</span></a>
      <a class="stat" href="#/blog"><b>${pub}</b><span>Published</span></a>
      <a class="stat" href="#/blog"><b>${posts.length - pub}</b><span>Drafts</span></a>
      <a class="stat" href="#/moments"><b>${images.length}</b><span>Moments (photos)</span></a>
    </div>
    <div class="quick">
      <a href="#/blog/new"><b>Write a blog post</b><span class="muted small">Create a new article and publish it.</span></a>
      <a href="#/moments"><b>Add moments</b><span class="muted small">Upload photos to the gallery.</span></a>
      <a href="#/hero"><b>Change hero photo</b><span class="muted small">Replace the portrait on the home page.</span></a>
      <a href="#/logo"><b>Site logo</b><span class="muted small">Upload the logo used in the footer and browser tab.</span></a>
    </div>
    <p class="small ${optimizer ? "muted" : ""}" style="margin-top:18px" role="status">${optimizer ? "Image optimizer: on. Every upload is converted to WebP automatically." : "Image optimizer: OFF. Uploads are stored as they are. Check that the sharp package installed on the server."}</p>`;
}

function blogList() {
  view.innerHTML = head("Blog posts", "Write, edit and publish articles.", `<a class="btn" href="#/blog/new">+ New post</a>`) +
    `<div class="tools"><input id="q" type="search" placeholder="Search posts" aria-label="Search posts"><select id="st" aria-label="Filter by status"><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Drafts</option></select><select id="mo" aria-label="Filter by month"></select><button type="button" id="mo-clear" class="btn ghost sm" hidden>Clear filters</button></div>
    <p id="mo-sum" class="muted small" role="status" style="margin:-4px 0 12px"></p>
    <div id="rows" class="list"></div>`;
  const monthKey = (p) => {
    const d = new Date(p.date);
    const v = Number.isNaN(d.getTime()) ? new Date(p.createdAt || "") : d;
    return Number.isNaN(v.getTime()) ? "" : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`;
  };
  const monthLabel = (k) => { const [y, m] = k.split("-"); return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(+y, +m - 1, 1)); };
  const months = [...new Set(posts.map(monthKey).filter(Boolean))].sort().reverse();
  $("#mo").innerHTML = `<option value="all">All months</option>` + months.map((k) => `<option value="${k}">${monthLabel(k)} (${posts.filter((p) => monthKey(p) === k).length})</option>`).join("");
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), st = $("#st").value, mo = $("#mo").value;
    const items = posts.filter((p) => (st === "all" || p.status === st) && (mo === "all" || monthKey(p) === mo) && `${p.title} ${p.category}`.toLowerCase().includes(q));
    $("#mo-clear").hidden = !q && st === "all" && mo === "all";
    $("#mo-sum").textContent = mo === "all" ? `${items.length} post${items.length === 1 ? "" : "s"}` : `${items.length} post${items.length === 1 ? "" : "s"} in ${monthLabel(mo)}`;
    $("#rows").innerHTML = items.length ? items.map((p) => `
      <div class="row">
        <div class="th">${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : ""}</div>
        <div class="tt"><a href="#/blog/${encodeURIComponent(p.slug)}">${esc(p.title)}</a><small>${esc(p.category)} · ${esc(p.date)}</small></div>
        <div class="ra"><span class="pill ${p.status === "draft" ? "" : "on"}">${p.status === "draft" ? "Draft" : "Published"}</span>
          <a class="btn ghost sm" href="#/blog/${encodeURIComponent(p.slug)}">Edit</a>
          ${p.status === "draft" ? "" : `<a class="btn ghost sm" href="/blog/${encodeURIComponent(p.slug)}.html" target="_blank" rel="noopener noreferrer">View</a>`}</div>
      </div>`).join("") : `<div class="empty">${posts.length ? "No posts match your search." : "No posts yet. Create the first one."}</div>`;
  };
  $("#q").addEventListener("input", draw);
  $("#st").addEventListener("change", draw);
  $("#mo").addEventListener("change", draw);
  $("#mo-clear").addEventListener("click", () => { $("#q").value = ""; $("#st").value = "all"; $("#mo").value = "all"; draw(); });
  draw();
}

function blogEditor(slug) {
  const post = slug === "new" ? null : posts.find((p) => p.slug === slug);
  if (slug !== "new" && !post) { location.hash = "#/blog"; return; }
  let slugTouched = Boolean(post);
  view.innerHTML = head(post ? "Edit post" : "New post", "", `<a class="btn ghost" href="#/blog">← All posts</a>`) + `
  <form id="pf" class="form" novalidate>
    <div class="fset"><h2>Article</h2><div class="fgrid">
      <div class="fld wide"><label for="f-title">Title <span class="req">*</span></label><input id="f-title" maxlength="140" value="${esc(post?.title)}"></div>
      <div class="fld"><label for="f-slug">URL slug <span class="req">*</span></label><input id="f-slug" maxlength="80" value="${esc(post?.slug)}"><span class="help">blog/&lt;slug&gt;.html</span></div>
      <div class="fld"><label for="f-cat">Category <span class="req">*</span></label><input id="f-cat" maxlength="60" value="${esc(post?.category)}"></div>
      <div class="fld"><label for="f-date">Date <span class="req">*</span></label><input id="f-date" maxlength="40" value="${esc(post?.date || today())}"></div>
      <div class="fld wide"><label for="f-ex">Short summary <span class="req">*</span></label><textarea id="f-ex" rows="3" maxlength="320">${esc(post?.excerpt)}</textarea><span class="help">Shown on the blog cards. Max 320 characters.</span></div>
      <div class="fld wide"><label for="f-body">Content <span class="req">*</span></label><textarea id="f-body" rows="14">${esc(post?.content?.join("\n\n"))}</textarea><span class="help">Leave a blank line between paragraphs.</span></div>
    </div></div>
    <div class="fset"><h2>Cover image</h2>
      <div class="img-f"><div class="pv" id="cv-pv">${post?.cover ? `<img src="${esc(post.cover)}" alt="">` : "No image"}</div>
        <div class="ctl"><input id="f-cover" type="text" inputmode="url" placeholder="https://… or upload" value="${esc(post?.cover)}" aria-label="Cover image URL">
          <div class="b"><label class="btn ghost sm" for="cv-file">Upload image</label><input id="cv-file" class="vh" type="file" accept="image/jpeg,image/png,image/webp"><button type="button" id="cv-rm" class="btn ghost sm">Remove</button></div>
          <span class="help">${UPLOAD_HINT}</span></div></div>
      <div class="fld" style="margin-top:14px"><label for="f-alt">Image description</label><input id="f-alt" maxlength="150" value="${esc(post?.coverAlt)}"></div>
    </div>
    <div class="fset"><h2>SEO &amp; search preview</h2>
      <div class="seo-layout">
        <div class="fgrid one">
          <div class="fld"><label for="f-seot">Meta title</label><input id="f-seot" maxlength="70" value="${esc(post?.seoTitle)}" placeholder="Uses the post title when empty"><span class="help"><b id="c-seot">0</b>/60 recommended</span><div class="meter"><i id="m-seot"></i></div></div>
          <div class="fld"><label for="f-slug2">URL slug</label><input id="f-slug2" value="${esc(post?.slug)}" placeholder="auto-from-title"><span class="help">Same as the URL slug above. Lowercase letters, numbers and hyphens.</span></div>
          <div class="fld"><label for="f-seod">Meta description</label><textarea id="f-seod" rows="3" maxlength="160" placeholder="Uses the short summary when empty">${esc(post?.seoDescription)}</textarea><span class="help"><b id="c-seod">0</b>/160 · aim for 120–160</span><div class="meter"><i id="m-seod"></i></div></div>
          <div class="fld"><label for="f-kw">Keywords</label><input id="f-kw" maxlength="200" value="${esc(post?.keywords)}" placeholder="career guidance, admissions, education"><span class="help">Separate with commas.</span><div id="kw-chips" class="kw-chips"></div></div>
        </div>
        <div class="seo-prev">
          <div class="pv-h">Google preview</div>
          <div class="serp"><div class="serp-url" id="sp-url"></div><div class="serp-title" id="sp-title"></div><div class="serp-desc" id="sp-desc"></div></div>
          <div class="pv-h">Social share preview</div>
          <div class="share"><div class="share-img" id="sh-img"></div><div class="share-b"><small>prof-chandrashekhar.com</small><b id="sh-title"></b><span id="sh-desc"></span></div></div>
        </div>
      </div>
    </div>
    <div class="savebar"><span id="st" class="st" role="status">${post ? (post.status === "draft" ? "Draft" : "Published") : "Not saved yet"}</span>
      <div class="acts">${post ? `<button type="button" id="del" class="btn danger">Delete</button>` : ""}<button type="button" id="b-draft" class="btn ghost">Save draft</button><button type="button" id="b-pub" class="btn">${post && post.status !== "draft" ? "Update" : "Publish"}</button></div></div>
  </form>`;
  const g = (id) => $(id);
  const status = (msg, cls = "") => { const s = g("#st"); s.textContent = msg; s.className = "st " + cls; };
  const setCover = (url) => { g("#f-cover").value = url; g("#cv-pv").innerHTML = url ? `<img src="${esc(url)}" alt="">` : "No image"; g("#f-cover").dispatchEvent(new Event("input")); };
  const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
  const meter = (id, len, min, max) => { const el = g(id); el.style.width = Math.min(100, (len / max) * 100) + "%"; el.className = len === 0 ? "" : len < min ? "warn" : len > max ? "bad" : "good"; };
  const updateSeo = () => {
    const title = g("#f-title").value.trim(), slug = g("#f-slug").value.trim();
    const mt = g("#f-seot").value.trim() || title, md = g("#f-seod").value.trim() || g("#f-ex").value.trim();
    const cover = g("#f-cover").value.trim();
    g("#c-seot").textContent = g("#f-seot").value.length;
    g("#c-seod").textContent = g("#f-seod").value.length;
    meter("#m-seot", mt.length, 30, 60);
    meter("#m-seod", md.length, 120, 160);
    g("#sp-url").textContent = `prof-chandrashekhar.com › blog › ${slug || "your-post"}`;
    g("#sp-title").textContent = clip((mt || "Post title") + " | Prof. Dr. Chandra Shekhar", 60);
    g("#sp-desc").textContent = clip(md || "The meta description appears here.", 160);
    g("#sh-title").textContent = clip(mt || "Post title", 70);
    g("#sh-desc").textContent = clip(md, 110);
    g("#sh-img").style.backgroundImage = cover ? `url("${cover.replace(/["\\]/g, "")}")` : "none";
    g("#kw-chips").innerHTML = g("#f-kw").value.split(",").map((k) => k.trim()).filter(Boolean).map((k) => `<span>${esc(k)}</span>`).join("");
  };
  g("#f-title").addEventListener("input", () => { if (!slugTouched) { g("#f-slug").value = slugify(g("#f-title").value); g("#f-slug2").value = g("#f-slug").value; } updateSeo(); });
  const syncSlug = (from, clean) => { slugTouched = true; const v = clean(g(from).value); g("#f-slug").value = g("#f-slug2").value = v; updateSeo(); };
  ["#f-slug", "#f-slug2"].forEach((id) => {
    g(id).addEventListener("input", () => syncSlug(id, slugLive));
    g(id).addEventListener("change", () => syncSlug(id, slugify));
  });
  ["#f-seot", "#f-seod", "#f-kw", "#f-ex", "#f-cover"].forEach((id) => g(id).addEventListener("input", updateSeo));
  updateSeo();
  g("#f-cover").addEventListener("change", () => setCover(g("#f-cover").value.trim()));
  g("#cv-rm").addEventListener("click", () => setCover(""));
  g("#cv-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readFile(file);
      status("Uploading image…");
      const r = await api("/api/upload", { method: "POST", body: JSON.stringify({ data }), mutate: true });
      setCover(r.cover);
      status("Image uploaded. Save the post to keep it.", "ok");
    } catch (err) { status(err.message, "err"); }
    e.target.value = "";
  });
  const save = async (state) => {
    const data = {
      title: g("#f-title").value.trim(), slug: slugify(g("#f-slug").value), category: g("#f-cat").value.trim(), date: g("#f-date").value.trim(),
      status: state, excerpt: g("#f-ex").value.trim(), cover: g("#f-cover").value.trim(), coverAlt: g("#f-alt").value.trim(),
      content: g("#f-body").value.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean),
      seoTitle: g("#f-seot").value.trim(), seoDescription: g("#f-seod").value.trim(), keywords: g("#f-kw").value.trim(),
    };
    const btns = view.querySelectorAll(".savebar button");
    btns.forEach((b) => (b.disabled = true));
    status(state === "draft" ? "Saving…" : "Publishing…");
    try {
      const r = await api(post ? `/api/posts?slug=${encodeURIComponent(post.slug)}` : "/api/posts", { method: post ? "PUT" : "POST", body: JSON.stringify(data), mutate: true });
      posts = r.posts || (await api("/api/posts")).posts;
      toast(r.output || (state === "draft" ? "Draft saved." : "Post published."));
      location.hash = "#/blog/" + encodeURIComponent(r.post.slug);
      if (post && r.post.slug === post.slug) route();
    } catch (err) {
      status(err.message, "err");
      btns.forEach((b) => (b.disabled = false));
    }
  };
  g("#b-draft").addEventListener("click", () => save("draft"));
  g("#b-pub").addEventListener("click", () => save("published"));
  g("#del")?.addEventListener("click", async () => {
    if (!confirm(`Delete “${post.title}”? Its public page will be removed.`)) return;
    try {
      const r = await api(`/api/posts?slug=${encodeURIComponent(post.slug)}`, { method: "DELETE", mutate: true });
      posts = r.posts || (await api("/api/posts")).posts;
      toast(r.output || "Post deleted.");
      location.hash = "#/blog";
    } catch (err) { status(err.message, "err"); }
  });
}

async function moments() {
  view.innerHTML = head("Moments", "Photos shown in the gallery section of the website.") +
    `<div id="dz" class="dz"><p style="margin:0 0 10px"><b>Drag photos here</b> or choose files</p><label class="btn" for="m-file">Upload photos</label><input id="m-file" class="vh" type="file" multiple accept="image/jpeg,image/png,image/webp"><p id="m-st" class="small" style="margin:12px 0 0" role="status">${UPLOAD_HINT}</p></div>
    <div id="m-grid" class="mgrid"></div>`;
  const draw = async () => {
    const { images } = await api("/api/gallery");
    $("#m-grid").innerHTML = images.length ? images.map((i) => `<div class="mitem"><div class="im"><img src="${esc(i.thumb || i.url)}" alt="" loading="lazy"></div><div class="mi"><span title="${esc(i.name)}">${esc(i.name)}</span><button type="button" class="btn danger sm" data-del="${esc(i.name)}">Delete</button></div></div>`).join("") : `<div class="empty" style="grid-column:1/-1">No photos yet.</div>`;
  };
  const upload = async (files) => {
    const list = [...files];
    if (!list.length) return;
    const st = $("#m-st");
    let done = 0;
    for (const file of list) {
      try {
        st.textContent = `Uploading ${done + 1} of ${list.length}…`;
        const data = await readFile(file);
        await api("/api/gallery?defer=1", { method: "POST", body: JSON.stringify({ data }), mutate: true });
        done++;
      } catch (err) { toast(err.message); }
    }
    if (done) {
      st.textContent = "Rebuilding the website…";
      try { const r = await api("/api/rebuild", { method: "POST", body: "{}", mutate: true }); toast(`${done} photo${done > 1 ? "s" : ""} added. ${r.output || ""}`); }
      catch (err) { toast(err.message); }
    }
    st.textContent = UPLOAD_HINT;
    draw();
  };
  $("#m-file").addEventListener("change", (e) => { upload(e.target.files); e.target.value = ""; });
  const dz = $("#dz");
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("on"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("on"); }));
  dz.addEventListener("drop", (e) => upload(e.dataTransfer.files));
  $("#m-grid").addEventListener("click", async (e) => {
    const name = e.target.closest("[data-del]")?.dataset.del;
    if (!name || !confirm(`Delete ${name} from the gallery?`)) return;
    try { const r = await api(`/api/gallery?name=${encodeURIComponent(name)}`, { method: "DELETE", mutate: true }); toast(r.output || "Photo deleted."); draw(); }
    catch (err) { toast(err.message); }
  });
  draw();
}

async function hero() {
  const { url } = await api("/api/hero");
  view.innerHTML = head("Hero photo", "The portrait shown at the top of the home page.") +
    `<div class="card" style="display:grid;gap:18px;justify-items:start"><div class="hero-pv"><img id="h-img" src="${esc(url)}" alt="Current hero photo"></div>
      <div class="acts"><label class="btn" for="h-file">Change photo</label><input id="h-file" class="vh" type="file" accept="image/jpeg,image/png,image/webp"><button type="button" id="h-reset" class="btn ghost">Use the default photo</button></div>
      <p id="h-st" class="small muted" role="status" style="margin:0">Portrait works best (4:5). ${UPLOAD_HINT}</p></div>`;
  $("#h-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const st = $("#h-st");
    try {
      const data = await readFile(file);
      st.textContent = "Uploading and rebuilding…";
      const r = await api("/api/hero", { method: "POST", body: JSON.stringify({ data }), mutate: true });
      $("#h-img").src = r.url;
      st.textContent = r.output || "Hero photo updated.";
      toast(r.output || "Hero photo updated.");
    } catch (err) { st.textContent = err.message; }
    e.target.value = "";
  });
  $("#h-reset").addEventListener("click", async () => {
    if (!confirm("Go back to the default hero photo?")) return;
    try { const r = await api("/api/hero", { method: "DELETE", mutate: true }); $("#h-img").src = r.url; $("#h-st").textContent = r.output || "Default photo restored."; toast(r.output || "Default photo restored."); }
    catch (err) { $("#h-st").textContent = err.message; }
  });
}

async function logoView() {
  const { url } = await api("/api/logo");
  view.innerHTML = head("Site logo", "Shown in the website footer and as the browser tab icon. A square image with a transparent background works best.") +
    `<div class="card" style="display:grid;gap:18px;justify-items:start"><div class="logo-pv" id="lg-pv">${url ? `<img id="lg-img" src="${esc(url)}" alt="Current logo">` : `<span class="muted">No logo yet. The “CS” monogram is used.</span>`}</div>
      <div class="acts"><label class="btn" for="lg-file">${url ? "Change logo" : "Upload logo"}</label><input id="lg-file" class="vh" type="file" accept="image/jpeg,image/png,image/webp">${url ? `<button type="button" id="lg-del" class="btn danger">Remove</button>` : ""}</div>
      <p id="lg-st" class="small muted" role="status" style="margin:0">PNG with a transparent background is kept transparent. ${UPLOAD_HINT}</p></div>`;
  const st = $("#lg-st");
  $("#lg-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readFile(file, 512);
      st.textContent = "Uploading…";
      const r = await api("/api/logo", { method: "POST", body: JSON.stringify({ data }), mutate: true });
      toast(r.output || "Logo updated.");
      logoView();
    } catch (err) { st.textContent = err.message; }
    e.target.value = "";
  });
  $("#lg-del")?.addEventListener("click", async () => {
    if (!confirm("Remove the logo and go back to the “CS” monogram?")) return;
    try { const r = await api("/api/logo", { method: "DELETE", mutate: true }); toast(r.output || "Logo removed."); logoView(); }
    catch (err) { st.textContent = err.message; }
  });
}

/* ---------- router ---------- */
function route() {
  const [, section = "dashboard", arg] = (location.hash || "#/dashboard").split("/");
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === section));
  closeMenu();
  window.scrollTo(0, 0);
  const run = section === "blog" ? (arg ? () => blogEditor(decodeURIComponent(arg)) : blogList) : section === "moments" ? moments : section === "hero" ? hero : section === "logo" ? logoView : section === "videos" ? videosView : section === "settings" ? settingsView : section === "password" ? passwordView : dashboard;
  Promise.resolve(run()).catch((err) => { view.innerHTML = `<div class="empty">${esc(err.message)}</div>`; });
}

function closeMenu() {
  $("#side").classList.remove("open");
  $("#scrim").hidden = true;
  $("#menu-btn").setAttribute("aria-expanded", "false");
}
$("#menu-btn").addEventListener("click", () => {
  $("#side").classList.add("open");
  $("#scrim").hidden = false;
  $("#menu-btn").setAttribute("aria-expanded", "true");
});
$("#scrim").addEventListener("click", closeMenu);
window.addEventListener("hashchange", route);

async function start() {
  loginView.hidden = true;
  app.hidden = false;
  posts = (await api("/api/posts")).posts;
  route();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  const err = $("#login-error");
  btn.disabled = true;
  err.hidden = true;
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify({ username: $("#username").value, password: $("#password").value }) });
    csrf = (await api("/api/session")).csrf;
    await start();
  } catch (x) { err.textContent = x.message; err.hidden = false; }
  btn.disabled = false;
});

$("#logout").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST", mutate: true }); } catch {}
  csrf = "";
  app.hidden = true;
  loginView.hidden = false;
  $("#password").value = "";
});

(async () => {
  try {
    const s = await api("/api/session");
    if (s.authenticated) { csrf = s.csrf; await start(); }
  } catch {}
})();
