/* Settings and Change password views. Shares helpers ($, api, head, esc, toast, view) with admin.js. */
async function settingsView() {
  const { settings } = await api("/api/settings");
  const socialRow = (s = { name: "", url: "" }) => `<div class="srow"><input class="s-name" placeholder="Name (e.g. Instagram)" value="${esc(s.name)}" aria-label="Social network name"><input class="s-url" placeholder="https://…" value="${esc(s.url)}" aria-label="Social profile link"><button type="button" class="btn danger sm s-del" aria-label="Remove link">Remove</button></div>`;
  const phoneRow = (p = "") => `<div class="srow one"><input class="p-val" placeholder="+91 …" value="${esc(p)}" aria-label="Phone number"><button type="button" class="btn danger sm p-del" aria-label="Remove phone">Remove</button></div>`;
  view.innerHTML = head("Settings", "Contact details, social media links and basic site information.") + `
  <form id="sf" class="form" novalidate>
    <div class="fset"><h2>Site information</h2><div class="fgrid">
      <div class="fld wide"><label for="s-title">Site title</label><input id="s-title" maxlength="70" value="${esc(settings.siteTitle)}"><span class="help">Shown in the browser tab and Google results.</span></div>
      <div class="fld wide"><label for="s-desc">Site description</label><textarea id="s-desc" rows="3" maxlength="200">${esc(settings.metaDescription)}</textarea><span class="help">Home page search description, up to 200 characters.</span></div>
    </div></div>
    <div class="fset"><h2>Contact details</h2><div class="fgrid">
      <div class="fld"><label for="s-wa">WhatsApp number</label><input id="s-wa" inputmode="numeric" value="${esc(settings.whatsapp)}"><span class="help">With country code, digits only. Example: 918826252304</span></div>
      <div class="fld"><label for="s-email">Email</label><input id="s-email" type="email" value="${esc(settings.email)}"></div>
      <div class="fld wide"><label for="s-office">Office / address</label><input id="s-office" maxlength="160" value="${esc(settings.office)}"></div>
      <div class="fld wide"><label>Phone numbers</label><div id="phones" class="slist">${settings.phones.map(phoneRow).join("")}</div><div><button type="button" id="add-phone" class="btn ghost sm">+ Add phone</button></div></div>
    </div></div>
    <div class="fset"><h2>Social media links</h2>
      <p class="muted small" style="margin:0 0 12px">Add or remove networks. Links must start with https://</p>
      <div id="socials" class="slist">${settings.socials.map(socialRow).join("")}</div>
      <div style="margin-top:10px"><button type="button" id="add-social" class="btn ghost sm">+ Add social link</button></div>
    </div>
    <div class="savebar"><span id="sf-st" class="st" role="status">Changes appear on the website about a minute after saving.</span><div class="acts"><button type="submit" class="btn">Save settings</button></div></div>
  </form>`;
  $("#socials").addEventListener("click", (e) => e.target.closest(".s-del")?.parentElement.remove());
  $("#phones").addEventListener("click", (e) => e.target.closest(".p-del")?.parentElement.remove());
  $("#add-social").addEventListener("click", () => $("#socials").insertAdjacentHTML("beforeend", socialRow()));
  $("#add-phone").addEventListener("click", () => $("#phones").insertAdjacentHTML("beforeend", phoneRow()));
  $("#sf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = $("#sf-st"), btn = e.target.querySelector("button[type=submit]");
    const data = {
      siteTitle: $("#s-title").value, metaDescription: $("#s-desc").value, whatsapp: $("#s-wa").value, email: $("#s-email").value, office: $("#s-office").value,
      phones: [...document.querySelectorAll(".p-val")].map((i) => i.value),
      socials: [...document.querySelectorAll("#socials .srow")].map((r) => ({ name: r.querySelector(".s-name").value, url: r.querySelector(".s-url").value })),
    };
    btn.disabled = true; st.className = "st"; st.textContent = "Saving…";
    try { const r = await api("/api/settings", { method: "PUT", body: JSON.stringify(data), mutate: true }); st.className = "st ok"; st.textContent = r.output || "Saved."; toast(r.output || "Settings saved."); }
    catch (err) { st.className = "st err"; st.textContent = err.message; }
    btn.disabled = false;
  });
}

async function passwordView() {
  const { username } = await api("/api/session");
  view.innerHTML = head("Account", "Change your Admin ID and password for signing in to this dashboard.") + `
  <form id="pw" class="form" style="max-width:560px" novalidate>
    <div class="fset"><h2>Sign-in details</h2><div class="fgrid one">
      <div class="fld"><label for="ac-user">Admin ID</label><input id="ac-user" autocomplete="username" maxlength="32" value="${esc(username)}"><span class="help">3–32 characters: letters, numbers, dot, dash or underscore.</span></div>
      <div class="fld"><label for="pw-new">New password <span class="muted">(leave empty to keep the current one)</span></label><input id="pw-new" type="password" autocomplete="new-password"><span class="help">At least 8 characters. A longer phrase is safer.</span><div class="meter"><i id="pw-m"></i></div></div>
      <div class="fld"><label for="pw-con">Confirm new password</label><input id="pw-con" type="password" autocomplete="new-password"></div>
      <div class="acts"><button type="button" id="ac-gen" class="btn ghost sm">Generate secure ID &amp; password</button><label class="sw"><input id="pw-show" type="checkbox"> Show passwords</label></div>
      <p id="ac-note" class="small muted" style="margin:0" hidden>Generated. Save these somewhere safe, then press “Save changes”.</p>
    </div></div>
    <div class="fset"><h2>Confirm it is you</h2><div class="fgrid one">
      <div class="fld"><label for="pw-cur">Current password</label><input id="pw-cur" type="password" autocomplete="current-password"></div>
    </div></div>
    <div class="savebar"><span id="pw-st" class="st" role="status"></span><div class="acts"><button type="submit" class="btn">Save changes</button></div></div>
  </form>`;
  const strength = (p) => [p.length >= 8, p.length >= 12, /[A-Z]/.test(p) && /[a-z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
  const fields = ["#pw-cur", "#pw-new", "#pw-con"].map((id) => $(id));
  const meterUpdate = () => { const v = $("#pw-new").value, n = strength(v), m = $("#pw-m"); m.style.width = n * 20 + "%"; m.className = !v ? "" : n <= 2 ? "bad" : n === 3 ? "warn" : "good"; };
  $("#pw-new").addEventListener("input", meterUpdate);
  $("#pw-show").addEventListener("change", (e) => fields.forEach((i) => { i.type = e.target.checked ? "text" : "password"; }));
  const rand = (chars, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => chars[x % chars.length]).join("");
  $("#ac-gen").addEventListener("click", () => {
    const id = "admin-" + rand("abcdefghjkmnpqrstuvwxyz23456789", 5);
    const pass = rand("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789", 14) + rand("!@#$%*-_", 2);
    $("#ac-user").value = id; $("#pw-new").value = pass; $("#pw-con").value = pass;
    $("#pw-show").checked = true; fields.forEach((i) => { i.type = "text"; });
    $("#ac-note").hidden = false; meterUpdate();
  });
  $("#pw").addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = $("#pw-st"), cur = $("#pw-cur").value, nw = $("#pw-new").value, con = $("#pw-con").value, user = $("#ac-user").value.trim();
    const fail = (m) => { st.className = "st err"; st.textContent = m; };
    if (!cur) return fail("Enter your current password to confirm.");
    if (nw && nw.length < 8) return fail("The new password must be at least 8 characters.");
    if (nw !== con) return fail("The two new passwords do not match.");
    try {
      await api("/api/account", { method: "POST", body: JSON.stringify({ currentPassword: cur, username: user, newPassword: nw }), mutate: true });
      ["#pw-cur", "#pw-new", "#pw-con"].forEach((id) => { $(id).value = ""; });
      $("#pw-m").style.width = "0"; $("#ac-note").hidden = true;
      st.className = "st ok"; st.textContent = "Saved. Use the new details next time you sign in."; toast("Account updated.");
    } catch (err) { fail(err.message); }
  });
}

async function videosView() {
  const { url } = await api("/api/youtube-thumb");
  view.innerHTML = head("YouTube thumbnail", "Cover image shown on the “DD Morning Live Show” video card on the home page.") +
    `<div class="card" style="display:grid;gap:18px;justify-items:start"><div class="yt-pv" id="yt-pv">${url ? `<img id="yt-img" src="${esc(url)}" alt="Current YouTube thumbnail">` : `<span class="muted">No custom thumbnail yet. The default image is used.</span>`}</div>
      <div class="acts"><label class="btn" for="yt-file">${url ? "Change thumbnail" : "Upload thumbnail"}</label><input id="yt-file" class="vh" type="file" accept="image/jpeg,image/png,image/webp">${url ? `<button type="button" id="yt-del" class="btn danger">Remove</button>` : ""}</div>
      <p id="yt-st" class="small muted" role="status" style="margin:0">Wide image (16:9) works best, for example 1280×720. It is converted to WebP automatically.</p></div>`;
  const st = $("#yt-st");
  $("#yt-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readFile(file, 1600);
      st.textContent = "Uploading…";
      const r = await api("/api/youtube-thumb", { method: "POST", body: JSON.stringify({ data }), mutate: true });
      toast(r.output || "Thumbnail updated.");
      videosView();
    } catch (err) { st.textContent = err.message; }
    e.target.value = "";
  });
  $("#yt-del")?.addEventListener("click", async () => {
    if (!confirm("Remove the custom thumbnail and go back to the default image?")) return;
    try { const r = await api("/api/youtube-thumb", { method: "DELETE", mutate: true }); toast(r.output || "Thumbnail removed."); videosView(); }
    catch (err) { st.textContent = err.message; }
  });
}
