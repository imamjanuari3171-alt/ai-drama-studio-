/* AI DRAMA STUDIO — client-only BYOK edition
   API keys are encrypted locally with AES-GCM + PBKDF2.
   A key is decrypted into memory only after the user unlocks the local vault.
*/
const $ = (s) => document.querySelector(s);
const STORAGE = {
  vault: "ads_vault_v1",
  projects: "ads_projects_v1",
  provider: "ads_provider_v1",
  model: "ads_model_v1"
};
const PROVIDERS = {
  openai: { name: "OpenAI", defaultModel: "gpt-6-astra", help: "Gunakan model yang tersedia pada akun OpenAI API. Periksa kompatibilitas akses dan CORS." },
  gemini: { name: "Google Gemini", defaultModel: "gemini-2.5-flash", help: "Gunakan model Gemini yang tersedia pada Google AI Studio dan API key kamu." },
  kie: { name: "Kie.ai", defaultModel: "", help: "Gunakan model chat yang tersedia di Kie.ai. Kie menyediakan daftar model pada endpoint OpenAI Responses-compatible." }
};
let unlockedApiKey = "";
let currentResult = "";
let currentProject = null;

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 4200);
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function getProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE.projects) || "[]"); }
  catch { return []; }
}
function saveProjects(items) {
  localStorage.setItem(STORAGE.projects, JSON.stringify(items.slice(0, 100)));
  renderProjects();
}
function go(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  const heading = $(`#view-${view} h1`);
  $("#crumbCurrent").textContent = heading?.textContent || view;
  $("#sidebar").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
$("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

function providerId() { return $("#providerSelect").value; }
function selectedModel() { return $("#modelInput").value.trim(); }
function syncProviderUI() {
  const id = providerId();
  const p = PROVIDERS[id];
  $("#modelInput").value = localStorage.getItem(STORAGE.model) || p.defaultModel;
  $("#modelHelp").textContent = p.help;
  localStorage.setItem(STORAGE.provider, id);
  localStorage.setItem(STORAGE.model, $("#modelInput").value);
  updateSummary();
}
$("#providerSelect").addEventListener("change", () => {
  localStorage.setItem(STORAGE.model, $("#modelInput").value);
  syncProviderUI();
  unlockedApiKey = "";
  $("#keyStatus").textContent = "Provider berubah. Buka brankas untuk provider ini atau simpan key baru.";
});
$("#modelInput").addEventListener("input", () => {
  localStorage.setItem(STORAGE.model, $("#modelInput").value);
  updateSummary();
});
function updateSummary() {
  const id = providerId();
  const vault = readVault();
  const exists = Boolean(vault?.[id]);
  $("#createProviderSummary").textContent = `${PROVIDERS[id].name} · ${selectedModel() || "Model belum diisi"} · ${exists ? "API Key terenkripsi tersimpan" : "API Key belum tersimpan"}. Buka menu AI & API Key untuk mengelola koneksi.`;
  $("#activeProvider").textContent = PROVIDERS[id].name;
  $("#providerLabel").textContent = exists ? "Key terenkripsi tersedia di perangkat" : "API Key belum tersimpan";
}
function readVault() {
  try { return JSON.parse(localStorage.getItem(STORAGE.vault) || "{}"); }
  catch { return {}; }
}
function writeVault(vault) { localStorage.setItem(STORAGE.vault, JSON.stringify(vault)); }
function bytesToB64(bytes) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
function b64ToBytes(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
async function deriveAesKey(password, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2", salt, iterations:310000, hash:"SHA-256"},
    material, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]
  );
}
async function encryptLocalSecret(secret, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, new TextEncoder().encode(secret));
  return {v:1,salt:bytesToB64(salt),iv:bytesToB64(iv),ciphertext:bytesToB64(new Uint8Array(encrypted)),updatedAt:new Date().toISOString()};
}
async function decryptLocalSecret(record, password) {
  const key = await deriveAesKey(password, b64ToBytes(record.salt));
  const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv:b64ToBytes(record.iv)}, key, b64ToBytes(record.ciphertext));
  return new TextDecoder().decode(plain);
}
$("#toggleKey").addEventListener("click", () => {
  const input = $("#apiKeyInput");
  input.type = input.type === "password" ? "text" : "password";
});
$("#saveKey").addEventListener("click", async () => {
  const id = providerId();
  const apiKey = $("#apiKeyInput").value.trim();
  const password = $("#vaultPassword").value;
  if (!apiKey) return toast("Masukkan API Key terlebih dahulu.");
  if (password.length < 10) return toast("Kata sandi brankas minimal 10 karakter.");
  if (!selectedModel()) return toast("Masukkan Model ID terlebih dahulu.");
  try {
    const vault = readVault();
    vault[id] = await encryptLocalSecret(apiKey, password);
    writeVault(vault);
    unlockedApiKey = apiKey;
    $("#apiKeyInput").value = "";
    $("#vaultPassword").value = "";
    $("#keyStatus").textContent = `${PROVIDERS[id].name}: API Key berhasil dienkripsi dan disimpan lokal. Key terbuka di memori untuk sesi ini.`;
    updateSummary();
    toast("API Key terenkripsi dan tersimpan di perangkat.");
  } catch (e) { toast("Gagal mengenkripsi key: " + e.message); }
});
$("#unlockKey").addEventListener("click", async () => {
  const id = providerId();
  const password = $("#vaultPassword").value;
  const record = readVault()[id];
  if (!record) return toast("Belum ada key tersimpan untuk provider ini.");
  if (!password) return toast("Masukkan kata sandi brankas.");
  try {
    unlockedApiKey = await decryptLocalSecret(record, password);
    $("#vaultPassword").value = "";
    $("#apiKeyInput").value = "";
    $("#keyStatus").textContent = `${PROVIDERS[id].name}: brankas terbuka. Key tersedia di memori sesi.`;
    toast("Brankas berhasil dibuka.");
  } catch {
    unlockedApiKey = "";
    toast("Kata sandi salah atau data brankas rusak.");
  }
});
$("#deleteKey").addEventListener("click", () => {
  const id = providerId();
  const vault = readVault();
  if (!vault[id]) return toast("Tidak ada key tersimpan untuk provider ini.");
  if (!confirm(`Hapus API Key ${PROVIDERS[id].name} dari perangkat ini?`)) return;
  delete vault[id];
  writeVault(vault);
  unlockedApiKey = "";
  $("#keyStatus").textContent = "API Key lokal telah dihapus.";
  updateSummary();
  toast("Key dihapus dari penyimpanan aplikasi.");
});

async function providerRequest(prompt) {
  const id = providerId();
  const model = selectedModel();
  if (!unlockedApiKey) throw new Error("Brankas belum terbuka. Buka menu AI & API Key terlebih dahulu.");
  if (!model) throw new Error("Model ID belum diisi.");
  if (id === "openai") return callOpenAI(prompt, model, unlockedApiKey);
  if (id === "gemini") return callGemini(prompt, model, unlockedApiKey);
  if (id === "kie") return callKie(prompt, model, unlockedApiKey);
  throw new Error("Provider tidak dikenal.");
}
async function callOpenAI(prompt, model, key) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({model,input:prompt})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}. Jika ada pesan CORS, koneksi browser langsung tidak didukung pada konfigurasi ini.`);
  const text = data.output_text || (data.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text || "").join("\n");
  if (!text) throw new Error("OpenAI mengembalikan output kosong.");
  return {text,model:data.model || model};
}
async function callGemini(prompt, model, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method:"POST",
    headers:{"x-goog-api-key":key,"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.85,maxOutputTokens:12000}})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}. Periksa model, key, kuota, dan CORS.`);
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("\n");
  if (!text) throw new Error("Gemini tidak mengembalikan teks. Periksa safety response dan model.");
  return {text,model};
}
async function callKie(prompt, model, key) {
  // KIE documents an OpenAI Responses-compatible endpoint for its chat models.
  const response = await fetch("https://api.kie.ai/openai/v1/responses", {
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({model,input:prompt})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.msg || `Kie.ai HTTP ${response.status}. Periksa model dan CORS.`);
  if (data.code && Number(data.code) !== 200) throw new Error(data.msg || `Kie.ai code ${data.code}`);
  const text = data.output_text || (data.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text" || x.type === "text").map(x => x.text || "").join("\n");
  if (!text) throw new Error("Kie.ai mengembalikan output kosong atau model tidak mendukung Responses API.");
  return {text,model:data.model || model};
}
$("#testProvider").addEventListener("click", async () => {
  try {
    $("#keyStatus").textContent = "Mengirim tes koneksi...";
    const result = await providerRequest("Balas singkat dalam Bahasa Indonesia: koneksi AI DRAMA STUDIO berhasil.");
    $("#keyStatus").textContent = `Koneksi berhasil · ${result.model} · Respons: ${result.text.slice(0,180)}`;
    toast("Tes provider berhasil.");
  } catch (e) {
    $("#keyStatus").textContent = "Tes gagal: " + e.message;
    toast(e.message);
  }
});

function makePrompt(v) {
  return `Kamu adalah showrunner, penulis skenario, script editor, dan sutradara drama profesional. Buat BRIEF PRODUKSI DRAMA lengkap dan siap dipakai untuk produksi video AI.

BAHASA: ${v.language}
GENRE: ${v.genre}
DURASI TARGET: ${v.duration} menit
JUMLAH SCENE: tepat ${v.scenes}
DURASI TARGET PER SCENE: ${v.sceneSeconds} detik
TARGET PENONTON: ${v.audience}
GAYA: ${v.style}

IDE CERITA:
${v.idea}

ATURAN:
- Cerita harus orisinal, logis, memiliki sebab-akibat, hook kuat dalam 5-15 detik awal, eskalasi konflik, klimaks dan resolusi.
- Jaga konsistensi nama, usia, hubungan, wajah, pakaian, sifat dan properti karakter.
- Dialog natural dan sesuai karakter.
- Setiap scene harus memajukan cerita.
- Prompt text-to-video ditulis dalam bahasa Inggris; dialog tetap dalam bahasa output.
- Jangan menyebut cerita sebagai kisah nyata kecuali dinyatakan pengguna.
- Jika informasi kurang, ambil keputusan kreatif yang masuk akal.
- Jangan berhenti pada outline; tulis brief substantif.

FORMAT:
1. Tiga alternatif judul dan satu rekomendasi.
2. Logline.
3. Premis dan sinopsis lengkap (awal, tengah, akhir).
4. Tema, pesan, unique selling point.
5. Character Bible: nama, usia, peran, sifat, tujuan, konflik, cara bicara, detail fisik, kostum, ciri konsistensi.
6. Dunia cerita: lokasi, periode, atmosfer, aturan kontinuitas.
7. Struktur cerita: hook, setup, pemicu konflik, eskalasi, klimaks, resolusi, cliffhanger.
8. STORYBOARD tepat ${v.scenes} scene. Untuk SETIAP scene tulis:
   - Nomor dan judul scene.
   - Timecode dan durasi.
   - Lokasi dan waktu.
   - Tujuan dramatik.
   - Aksi dan deskripsi visual.
   - Dialog per karakter.
   - Ekspresi dan emosi.
   - Shot size, angle, camera movement.
   - Lighting, ambience, musik dan SFX.
   - Prompt text-to-video bahasa Inggris siap salin, detail karakter, aksi, lokasi, komposisi, kamera, cahaya, cinematic style, 16:9, tanpa teks/subtitle/watermark.
   - Negative prompt.
9. Catatan kontinuitas karakter, kostum dan properti.
10. Arahan editing, pacing, transisi, sound design, color grading.
11. Checklist produksi.`;
}
$("#idea").addEventListener("input", () => $("#charCount").textContent = `${$("#idea").value.length} / 3500`);
$("#dramaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const v = {
    idea:$("#idea").value.trim(), genre:$("#genre").value, language:$("#language").value,
    duration:Math.min(120,Math.max(1,Number($("#duration").value)||8)),
    scenes:Math.min(40,Math.max(1,Number($("#scenes").value)||12)),
    sceneSeconds:Math.min(60,Math.max(4,Number($("#sceneSeconds").value)||8)),
    audience:$("#audience").value.trim(), style:$("#style").value.trim()
  };
  if (v.idea.length < 12) return toast("Ide cerita minimal 12 karakter.");
  if (!unlockedApiKey) { go("settings"); return toast("Buka brankas API Key terlebih dahulu."); }
  const button = $("#generateBtn");
  button.disabled = true; button.textContent = "✦ Sedang membuat brief...";
  try {
    const result = await providerRequest(makePrompt(v));
    currentResult = result.text;
    const titleMatch = result.text.match(/(?:JUDUL UTAMA|JUDUL)[^\n]*\n+(.+)/i);
    currentProject = {
      id:crypto.randomUUID(), title:titleMatch?.[1]?.replace(/[*#]/g,"").trim().slice(0,80) || v.idea.slice(0,60),
      idea:v.idea, genre:v.genre, provider:providerId(), model:result.model,
      createdAt:new Date().toISOString(), content:result.text
    };
    const projects = getProjects(); projects.unshift(currentProject); saveProjects(projects);
    showResult(currentProject);
  } catch (e) {
    toast(e.message);
    if (/CORS|Failed to fetch|NetworkError/i.test(e.message)) {
      $("#keyStatus").textContent = "Koneksi browser ditolak atau gagal. Cek koneksi internet dan dukungan CORS provider.";
    }
  } finally {
    button.disabled = false; button.innerHTML = '✦ Generate brief drama <span>→</span>';
  }
});
function showResult(p) {
  currentProject = p; currentResult = p.content;
  $("#resultTitle").textContent = p.title;
  $("#resultMeta").textContent = `${PROVIDERS[p.provider].name} · ${p.model} · ${new Date(p.createdAt).toLocaleString("id-ID")}`;
  $("#resultContent").textContent = p.content;
  go("result");
}
$("#copyResult").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(currentResult); toast("Brief berhasil disalin."); }
  catch { toast("Clipboard tidak tersedia. Pilih dan salin teks secara manual."); }
});
$("#downloadResult").addEventListener("click", () => {
  const blob = new Blob([currentResult],{type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href=url; a.download=(currentProject?.title || "brief-drama").toLowerCase().replace(/[^a-z0-9]+/g,"-")+".txt";
  a.click(); URL.revokeObjectURL(url);
});
$("#backProjects").addEventListener("click",()=>go("projects"));
function renderProjects() {
  const projects = getProjects();
  $("#projectCount").textContent = projects.length;
  $("#lastProject").textContent = projects[0] ? new Date(projects[0].createdAt).toLocaleDateString("id-ID") : "Belum ada";
  renderProjectTarget("#recentProjects",projects.slice(0,3));
  renderProjectTarget("#allProjects",projects);
}
function renderProjectTarget(selector,projects) {
  const target = $(selector);
  if (!projects.length) {
    target.innerHTML = `<div class="empty"><div style="font-size:25px;color:var(--gold)">✧</div><b>Belum ada proyek drama</b><p>Mulai dari sebuah ide dan simpan hasilnya di perangkat ini.</p></div>`;
    return;
  }
  target.innerHTML = projects.map(p=>`<article class="project-card"><span class="tag">${escapeHTML(p.genre)} · ${escapeHTML((p.provider||"").toUpperCase())}</span><h3>${escapeHTML(p.title)}</h3><p>${escapeHTML(p.idea)}</p><div class="card-bottom"><span>${new Date(p.createdAt).toLocaleDateString("id-ID")}</span><button data-open="${p.id}">Buka brief →</button></div></article>`).join("");
  target.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>{
    const p=getProjects().find(x=>x.id===b.dataset.open); if(p)showResult(p);
  }));
}
$("#today").textContent = new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
$("#providerSelect").value = localStorage.getItem(STORAGE.provider) || "gemini";
$("#modelInput").value = localStorage.getItem(STORAGE.model) || PROVIDERS[$("#providerSelect").value].defaultModel;
syncProviderUI();
renderProjects();
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
