import { SHOLAT, WAKTU_HARIAN, QORI } from "./config.js";
import { loadIqomah, saveIqomah, loadAdzan, saveAdzan, loadPengumuman, savePengumuman } from "./settings.js";
import { loadTampilan, saveTampilan } from "./tampilan.js";
import { loadMurotal, saveMurotal } from "./murotal.js";
import { loadQr, saveQr, clearQr, loadRotasi, saveRotasi } from "./rotasi.js";
import { loadJadwalPengajian, saveJadwalPengajian } from "./jadwal-pengajian.js";
import { loadJumatSettings, saveJumatSettings, loadJumatSlides, saveJumatSlides } from "./jumat-mode.js";
import { putMedia, delMedia, getMedia } from "./media-db.js";
import { mainkanNada } from "./nada.js";
import { TEMA_TAMPILAN } from "./tema/tampilan/registry.js";
import { simpanBgLayar, hapusBgLayar, urlBgLayar } from "./bg-layar.js";
import { fsaTersedia, pilihFolderImg, folderImgDipilih, ambilFolderImg } from "./folder-proyek.js";

const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Pemilih berkas custom (ganti "Choose File" bawaan) - input file asli tetap
// jadi elemen fungsional (disembunyikan visual lewat CSS .file-picker-input),
// dipicu klik lewat tombol Pilih File/Ganti. Reset ke status kosong dengan
// men-dispatch event "change" setelah `input.value = ""`.
function initFilePicker(prefix) {
  const input = $(`${prefix}-file`);
  const empty = $(`${prefix}-file-empty`);
  const filled = $(`${prefix}-file-filled`);
  const buka = () => input.click();
  empty.querySelector(".file-picker-tombol").addEventListener("click", buka);
  filled.querySelector(".file-picker-ganti").addEventListener("click", buka);
  input.addEventListener("change", () => {
    const f = input.files[0];
    if (!f) { empty.hidden = false; filled.hidden = true; return; }
    $(`${prefix}-file-nama`).textContent = f.name;
    $(`${prefix}-file-ukuran`).textContent = f.size < 1024 * 1024
      ? `${Math.round(f.size / 1024)} KB`
      : `${(f.size / 1024 / 1024).toFixed(1)} MB`;
    empty.hidden = true;
    filled.hidden = false;
  });
}

const IKON_IQOMAH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7"/><path d="M12 9.5v3.5l2 1.5"/><path d="M9 3l-2 2"/><path d="M15 3l2 2"/></svg>`;

function renderIqomah() {
  const settings = loadIqomah();
  const wrap = $("baris-sholat");
  wrap.innerHTML = "";
  $("admin-hint").hidden = true;
  for (const { key, label } of SHOLAT) {
    const s = settings[key];
    const row = document.createElement("div");
    row.className = "baris-kaya";
    row.innerHTML = `
      <span class="ikon-baris" aria-hidden="true">${IKON_IQOMAH}</span>
      <div class="baris-kaya-teks">
        <label class="label-sholat" for="menit-${key}">${label}</label>
        <p class="hint-baris">Jeda menit dari azan ke iqomah.</p>
      </div>
      <div class="baris-kaya-kontrol">
        <div class="stepper">
          <button type="button" class="stepper-btn" data-target="menit-${key}" data-arah="-1" aria-label="Kurangi jeda ${label}">&minus;</button>
          <input type="number" min="0" max="60" step="1" id="menit-${key}" value="${s.menit}" inputmode="numeric">
          <span class="stepper-satuan">menit</span>
          <button type="button" class="stepper-btn" data-target="menit-${key}" data-arah="1" aria-label="Tambah jeda ${label}">+</button>
        </div>
        <label class="aktif-cek"><input type="checkbox" id="aktif-${key}" ${s.aktif ? "checked" : ""} aria-label="${label} aktif"></label>
      </div>
    `;
    wrap.appendChild(row);
  }
}

function simpanIqomah(e) {
  e.preventDefault();
  const settings = {};
  for (const { key } of SHOLAT) {
    const menit = parseInt($(`menit-${key}`).value, 10);
    settings[key] = {
      menit: Number.isFinite(menit) && menit >= 0 ? menit : 0,
      aktif: $(`aktif-${key}`).checked,
    };
  }
  saveIqomah(settings);
  tampilkanStatus("status-simpan");
}

function renderTampilan() {
  const t = loadTampilan();
  $("tampilan-header").checked = t.header;
  $("tampilan-maklumat").checked = t.maklumat;
}

function simpanTampilan(e) {
  e.preventDefault();
  saveTampilan({
    header: $("tampilan-header").checked,
    maklumat: $("tampilan-maklumat").checked,
  });
  tampilkanStatus("status-tampilan");
}

function simpanPengumumanDariForm() {
  const arr = [...document.querySelectorAll(".pengumuman-input")].map((el) => el.value.trim()).filter(Boolean);
  savePengumuman(arr);
  tampilkanStatus("status-pengumuman");
}

function buatBarisPengumuman(teks) {
  const li = document.createElement("li");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "pengumuman-input";
  input.placeholder = "Tulis pesan...";
  input.value = teks;
  input.addEventListener("change", simpanPengumumanDariForm);
  const hapus = document.createElement("button");
  hapus.type = "button";
  hapus.className = "btn-inline btn-bahaya";
  hapus.textContent = "Hapus";
  hapus.addEventListener("click", () => {
    li.remove();
    simpanPengumumanDariForm();
  });
  li.append(input, hapus);
  return li;
}

function renderPengumuman() {
  const ul = $("pengumuman-list");
  ul.innerHTML = "";
  loadPengumuman().forEach((teks) => ul.appendChild(buatBarisPengumuman(teks)));
}

function tambahBarisPengumuman() {
  const li = buatBarisPengumuman("");
  $("pengumuman-list").appendChild(li);
  li.querySelector("input").focus();
}

const ROTASI_FIELDS = {
  sholat: { input: "rotasi-sholat", segmen: "segmen-sholat", nilai: "segmen-sholat-nilai" },
  kegiatan: { input: "rotasi-kegiatan", segmen: "segmen-kegiatan", nilai: "segmen-kegiatan-nilai" },
  qr: { input: "rotasi-qr", segmen: "segmen-qr", nilai: "segmen-qr-nilai" },
};
const ROTASI_MIN_BASIS = 14; // % - biar segmen durasi kecil tetap kebaca di pratinjau

function renderRotasi() {
  const r = loadRotasi();
  $("rotasi-sholat").value = r.sholatDetik;
  $("rotasi-kegiatan").value = r.jadwalPengajianDetik;
  $("rotasi-qr").value = r.qrDonasiDetik;
  recalcRotasiTimeline();
}

function recalcRotasiTimeline() {
  const vals = {};
  let total = 0;
  for (const [key, f] of Object.entries(ROTASI_FIELDS)) {
    const v = Math.max(0, parseInt($(f.input).value, 10) || 0);
    vals[key] = v;
    total += v;
  }
  $("rotasi-total-detik").textContent = total;
  for (const [key, f] of Object.entries(ROTASI_FIELDS)) {
    const basis = total > 0 ? Math.max((vals[key] / total) * 100, ROTASI_MIN_BASIS) : 100 / 3;
    $(f.segmen).style.flexBasis = basis + "%";
    $(f.nilai).textContent = vals[key] + " dtk";
  }
}

// Dipakai semua panel: klem nilai input number ke min/max-nya, tandai baris
// invalid sesaat kalau kelewat batas. Baris = elemen ".baris-kaya" terdekat.
function clampBarisInput(input) {
  const min = parseInt(input.min, 10);
  const max = parseInt(input.max, 10);
  let v = parseInt(input.value, 10);
  if (!Number.isFinite(v)) v = min;
  const invalid = (Number.isFinite(min) && v < min) || (Number.isFinite(max) && v > max);
  if (Number.isFinite(min)) v = Math.max(min, v);
  if (Number.isFinite(max)) v = Math.min(max, v);
  input.value = v;
  const baris = input.closest(".baris-kaya");
  if (!baris) return;
  baris.classList.toggle("invalid", invalid);
  if (invalid) setTimeout(() => baris.classList.remove("invalid"), 2200);
}

function simpanRotasi(e) {
  e.preventDefault();
  const angka = (val, def) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  saveRotasi({
    sholatDetik: angka($("rotasi-sholat").value, 60),
    jadwalPengajianDetik: angka($("rotasi-kegiatan").value, 20),
    qrDonasiDetik: angka($("rotasi-qr").value, 15),
  });
  tampilkanStatus("status-rotasi");
}

function tampilkanStatus(id) {
  const el = $(id);
  clearTimeout(el._timerStatus);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("tampil"));
  el._timerStatus = setTimeout(() => {
    el.classList.remove("tampil");
    setTimeout(() => { el.hidden = true; }, 200);
  }, 2000);
}

// ---------- Adzan ----------
function renderAdzan() {
  $("adzan-menit").value = loadAdzan().menit;
}

function simpanAdzanForm(e) {
  e.preventDefault();
  const menit = parseInt($("adzan-menit").value, 10);
  saveAdzan({ menit: Number.isFinite(menit) && menit >= 0 ? menit : 0 });
  tampilkanStatus("status-adzan");
}

// ---------- Background per layar (adzan/iqomah/donasi) ----------
const LAYAR_BG = ["adzan", "iqomah", "donasi"];

function renderBgLayar(layar) {
  const url = urlBgLayar(layar);
  const img = $(`${layar}-bg-preview`);
  img.src = url || "";
  img.hidden = !url;
}

async function simpanBgLayarForm(layar, { requireFile = true } = {}) {
  const file = $(`${layar}-bg-file`).files[0];
  if (!file) {
    if (requireFile) alert("Pilih gambar dulu.");
    return;
  }
  const ok = await simpanBgLayar(layar, file);
  if (!ok) { alert("Gagal menyimpan. Pastikan folder img/ sudah dipilih (tombol di sidebar) dan izinnya diberikan."); return; }
  $(`${layar}-bg-file`).value = "";
  renderBgLayar(layar);
  tampilkanStatus(`status-bg-${layar}`);
}

async function hapusBgLayarForm(layar) {
  if (!confirm("Hapus foto latar ini?")) return;
  await hapusBgLayar(layar);
  renderBgLayar(layar);
  tampilkanStatus(`status-bg-${layar}`);
}

// ---------- Folder project (File System Access API) ----------
async function renderFolderStatus() {
  const el = $("admin-folder-status");
  if (!fsaTersedia()) {
    el.textContent = "Folder img/: browser tidak didukung (pakai Chrome/Edge lewat http://localhost).";
    $("tombol-pilih-folder").disabled = true;
    return;
  }
  el.textContent = (await folderImgDipilih())
    ? "Folder img/: terhubung."
    : "Folder img/: belum dipilih - wajib diisi sebelum unggah latar/slide.";
}

async function pilihFolder() {
  try {
    await pilihFolderImg();
  } catch {
    return; // dibatalkan / ditolak user, diam saja
  }
  renderFolderStatus();
}

// ---------- Murotal ----------
function renderMurotal() {
  const s = loadMurotal();
  $("murotal-aktif").checked = s.aktif;
  $("murotal-mulai").value = s.mulaiMenit;
  $("murotal-berhenti").value = s.berhentiMenit;
  const wrap = $("murotal-per-sholat");
  wrap.innerHTML = "";
  for (const { key, label } of SHOLAT) {
    const row = document.createElement("label");
    row.className = "aktif-cek testing-toggle";
    row.title = `Putar murotal menjelang azan ${label}`;
    row.innerHTML = `<input type="checkbox" id="murotal-sholat-${key}" ${s.perSholat[key] ? "checked" : ""}> ${label}`;
    wrap.appendChild(row);
  }
  renderPlaylist();
}

const IKON_TRACK_OFFLINE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
const IKON_TRACK_STREAM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18l.01 0"/><path d="M9.172 15.172a4 4 0 0 1 5.656 0"/><path d="M6.343 12.343a8 8 0 0 1 11.314 0"/></svg>`;

let urlPreviewTerakhir = null;
let trackAktifId = null;
async function putarTrack(item) {
  const audio = $("murotal-preview");
  if (urlPreviewTerakhir) { URL.revokeObjectURL(urlPreviewTerakhir); urlPreviewTerakhir = null; }
  if (item.tipe === "offline") {
    const blob = await getMedia(item.mediaKey);
    if (!blob) { alert("File tidak ditemukan."); return; }
    urlPreviewTerakhir = URL.createObjectURL(blob);
    audio.src = urlPreviewTerakhir;
  } else {
    audio.src = item.url;
  }
  audio.play().catch(() => {});
  trackAktifId = item.id;
  $("murotal-preview-bar").hidden = false;
  $("murotal-preview-judul").textContent = item.label;
  renderPlaylist();
}
$("murotal-preview").addEventListener("ended", () => {
  trackAktifId = null;
  renderPlaylist();
});

function renderPlaylist() {
  const s = loadMurotal();
  const ul = $("murotal-playlist");
  ul.innerHTML = "";
  if (!s.playlist.length) { ul.innerHTML = "<li>(kosong)</li>"; return; }
  s.playlist.forEach((item) => {
    const li = document.createElement("li");
    li.classList.toggle("item-diputar", item.id === trackAktifId);
    const meta = item.tipe === "offline" ? "Berkas offline" : "Streaming &bull; EQuran.id";
    li.innerHTML = `
      <div class="admin-item-thumb">${item.tipe === "offline" ? IKON_TRACK_OFFLINE : IKON_TRACK_STREAM}</div>
      <div class="admin-item-info">
        <p class="admin-item-judul">${item.label}</p>
        <p class="admin-item-meta">${meta}</p>
      </div>
      <div class="admin-item-aksi">
        <button type="button" class="btn-inline" data-aksi="putar">Dengarkan</button>
        <button type="button" class="btn-inline btn-bahaya" data-aksi="hapus">Hapus</button>
      </div>
    `;
    li.querySelector('[data-aksi="putar"]').addEventListener("click", () => putarTrack(item));
    li.querySelector('[data-aksi="hapus"]').addEventListener("click", async () => {
      if (!confirm(`Hapus "${item.label}" dari playlist?`)) return;
      const cur = loadMurotal();
      cur.playlist = cur.playlist.filter((p) => p.id !== item.id);
      if (item.tipe === "offline") await delMedia(item.mediaKey);
      if (cur.posisi.index >= cur.playlist.length) cur.posisi = { index: 0, detik: 0 };
      saveMurotal(cur);
      if (trackAktifId === item.id) trackAktifId = null;
      renderPlaylist();
    });
    ul.appendChild(li);
  });
}

function simpanMurotal(e) {
  e.preventDefault();
  const s = loadMurotal();
  s.aktif = $("murotal-aktif").checked;
  const mulai = parseInt($("murotal-mulai").value, 10);
  const berhenti = parseInt($("murotal-berhenti").value, 10);
  if (!(mulai > berhenti) || berhenti < 0) {
    alert("Menit mulai harus lebih besar dari menit berhenti, dan berhenti minimal 0.");
    return;
  }
  s.mulaiMenit = mulai;
  s.berhentiMenit = berhenti;
  for (const { key } of SHOLAT) s.perSholat[key] = $(`murotal-sholat-${key}`).checked;
  saveMurotal(s);
  tampilkanStatus("status-murotal");
}

async function tambahFileMurotal() {
  const file = $("murotal-file").files[0];
  if (!file) return;
  const mediaKey = "murotal:" + uid();
  const ok = await putMedia(mediaKey, file);
  if (!ok) { alert("Gagal menyimpan file (IndexedDB tidak tersedia)."); return; }
  const s = loadMurotal();
  s.playlist.push({ id: uid(), tipe: "offline", label: file.name, mediaKey });
  saveMurotal(s);
  $("murotal-file").value = "";
  $("murotal-file").dispatchEvent(new Event("change"));
  renderPlaylist();
}

let daftarSurah = [];
async function muatDaftarSurah() {
  // Qori
  const qoriSel = $("murotal-qori");
  qoriSel.innerHTML = "";
  for (const [kode, nama] of Object.entries(QORI)) {
    const opt = document.createElement("option");
    opt.value = kode; opt.textContent = nama;
    qoriSel.appendChild(opt);
  }
  // Surah
  try {
    const res = await fetch("https://equran.id/api/v2/surat");
    const body = await res.json();
    daftarSurah = body.data || [];
    const sel = $("murotal-surah");
    sel.innerHTML = "";
    daftarSurah.forEach((su) => {
      const opt = document.createElement("option");
      opt.value = su.nomor;
      opt.textContent = `${su.nomor}. ${su.namaLatin}`;
      sel.appendChild(opt);
    });
  } catch {
    $("murotal-surah").innerHTML = "<option>Gagal memuat (perlu koneksi)</option>";
  }
}

function tambahApiMurotal() {
  const nomor = parseInt($("murotal-surah").value, 10);
  const qori = $("murotal-qori").value;
  const surah = daftarSurah.find((s) => s.nomor === nomor);
  if (!surah || !surah.audioFull || !surah.audioFull[qori]) { alert("Surah/qori tidak tersedia."); return; }
  const s = loadMurotal();
  s.playlist.push({
    id: uid(), tipe: "api", surah: nomor, qori,
    label: `${surah.namaLatin} - ${QORI[qori]}`,
    url: surah.audioFull[qori],
  });
  saveMurotal(s);
  renderPlaylist();
}

// ---------- Nada Iqomah ----------
async function simpanNada() {
  const file = $("nada-file").files[0];
  if (!file) { alert("Pilih file dulu."); return; }
  const ok = await putMedia("nadaIqomah", file);
  if (!ok) { alert("Gagal menyimpan (IndexedDB tidak tersedia)."); return; }
  $("nada-file").value = "";
  $("nada-file").dispatchEvent(new Event("change"));
  tampilkanStatus("status-nada");
}
async function hapusNada() {
  if (!confirm("Hapus nada iqomah ini? Layar akan pakai beep default.")) return;
  await delMedia("nadaIqomah");
  tampilkanStatus("status-nada");
}
function tesNada() {
  mainkanNada($("nada-preview"));
}

// ---------- Tema Tampilan ----------
// Satu tema berlaku untuk seluruh layar utama (lihat css/versi-baru.css, semua
// dikunci ke atribut data-versi). Tambah tema baru = tambah entri di
// TEMA_TAMPILAN + satu file tema/tampilan/<id>.png; kartu di bawah tidak perlu diubah.
const KEY_TEMA_TAMPILAN = "versiTampilan";

// Layout yang dirancang tanpa header/maklumat (lihat css/versi-biru.css) - opsi
// toggle di bawah tidak relevan buat layout ini, jadi disembunyikan.
const TEMA_TANPA_HEADER = ["biru"];

function syncTampilanToggle(temaId) {
  const kosong = TEMA_TANPA_HEADER.includes(temaId);
  $("baris-toggle-header").hidden = kosong;
  $("tampilan-toggle-kosong").hidden = !kosong;
}

function renderTema() {
  const fieldset = document.querySelector(`[data-tema-kartu="tampilan"]`);
  const tersimpan = localStorage.getItem(KEY_TEMA_TAMPILAN);
  const dipilih = tersimpan && TEMA_TAMPILAN[tersimpan] ? tersimpan : Object.keys(TEMA_TAMPILAN)[0];
  syncTampilanToggle(dipilih);
  for (const [id, { label }] of Object.entries(TEMA_TAMPILAN)) {
    const kartu = document.createElement("label");
    kartu.className = "tema-kartu";
    kartu.innerHTML = `
      <input type="radio" name="tema-tampilan" value="${id}" ${id === dipilih ? "checked" : ""}>
      <span class="tema-kartu-gambar">
        <img src="tema/tampilan/${id}.png" alt="" loading="lazy">
        <span class="tema-kartu-placeholder" hidden>${label}</span>
      </span>
      <span class="tema-kartu-label">${label}</span>
    `;
    const img = kartu.querySelector("img");
    img.addEventListener("error", () => {
      img.hidden = true;
      img.nextElementSibling.hidden = false;
    }, { once: true });
    fieldset.appendChild(kartu);
  }
  fieldset.addEventListener("change", (e) => {
    if (e.target.name === "tema-tampilan") syncTampilanToggle(e.target.value);
  });

  $("form-tema-tampilan").addEventListener("submit", (e) => {
    e.preventDefault();
    const dipilih = document.querySelector(`input[name="tema-tampilan"]:checked`);
    if (dipilih) localStorage.setItem(KEY_TEMA_TAMPILAN, dipilih.value);
    tampilkanStatus("status-tema-tampilan");
  });
}

// ---------- QR Donasi ----------
function renderQr() {
  const q = loadQr();
  if (q) {
    $("qr-judul").value = q.judul || "";
    $("qr-teks").value = q.teks || "";
    $("qr-preview").src = q.dataUrl;
    $("qr-preview").hidden = false;
  }
}

function simpanQr(e) {
  e.preventDefault();
  const file = $("qr-file").files[0];
  const judul = $("qr-judul").value.trim();
  const teks = $("qr-teks").value.trim();
  const simpanObj = (dataUrl) => {
    try { saveQr({ dataUrl, judul, teks }); }
    catch { alert("Gambar terlalu besar untuk disimpan. Pakai gambar QR yang lebih kecil."); return; }
    $("qr-preview").src = dataUrl;
    $("qr-preview").hidden = false;
    tampilkanStatus("status-qr");
  };
  if (file) {
    const reader = new FileReader();
    reader.onerror = () => alert("Gagal membaca file gambar.");
    reader.onload = () => simpanObj(reader.result);
    reader.readAsDataURL(file);
  } else {
    const q = loadQr();
    if (!q) { alert("Pilih gambar QR dulu."); return; }
    simpanObj(q.dataUrl); // update judul/teks saja
  }
}
function hapusQr() {
  if (!confirm("Hapus QR donasi ini?")) return;
  clearQr();
  $("qr-preview").hidden = true;
  $("qr-judul").value = "";
  $("qr-teks").value = "";
  $("qr-file").value = "";
  tampilkanStatus("status-qr");
}

// ---------- Jadwal Pengajian ----------
const HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function toggleTipePengajian() {
  const tipe = $("pengajian-tipe").value;
  $("baris-hari").hidden = tipe !== "mingguan";
  $("baris-tanggal").hidden = tipe !== "tanggal";
}

let editPengajianId = null;

function renderPengajian() {
  const arr = loadJadwalPengajian();
  const ul = $("pengajian-list");
  ul.innerHTML = "";
  if (!arr.length) { ul.innerHTML = "<li>(belum ada jadwal)</li>"; return; }
  arr.forEach((e) => {
    const kapan = e.tipe === "mingguan" ? `${HARI_NAMA[e.hari]} ${e.jam}` : `${e.tanggal} ${e.jam}`;
    const li = document.createElement("li");
    li.classList.toggle("aktif-edit", e.id === editPengajianId);
    li.innerHTML = `
      <div class="admin-item-info">
        <p class="admin-item-judul">${e.nama}</p>
        <p class="admin-item-meta">${kapan}${e.pengisi ? " &bull; " + e.pengisi : ""}</p>
      </div>
      <div class="admin-item-aksi">
        <button type="button" class="btn-inline" data-aksi="edit">Edit</button>
        <button type="button" class="btn-inline btn-bahaya" data-aksi="hapus">Hapus</button>
      </div>
    `;
    li.querySelector('[data-aksi="edit"]').addEventListener("click", () => mulaiEditPengajian(e));
    li.querySelector('[data-aksi="hapus"]').addEventListener("click", () => {
      if (!confirm(`Hapus kegiatan "${e.nama}"?`)) return;
      saveJadwalPengajian(loadJadwalPengajian().filter((x) => x.id !== e.id));
      if (editPengajianId === e.id) batalEditPengajian();
      renderPengajian();
    });
    ul.appendChild(li);
  });
}

function mulaiEditPengajian(e) {
  editPengajianId = e.id;
  $("pengajian-tipe").value = e.tipe;
  toggleTipePengajian();
  if (e.tipe === "mingguan") $("pengajian-hari").value = String(e.hari);
  else $("pengajian-tanggal").value = e.tanggal;
  $("pengajian-jam").value = e.jam;
  $("pengajian-nama").value = e.nama;
  $("pengajian-pengisi").value = e.pengisi || "";
  $("tombol-tambah-pengajian").textContent = "Update";
  $("tombol-batal-pengajian").hidden = false;
  $("form-pengajian").scrollIntoView({ behavior: "smooth", block: "nearest" });
  renderPengajian();
}

function batalEditPengajian() {
  editPengajianId = null;
  $("form-pengajian").reset();
  toggleTipePengajian();
  $("tombol-tambah-pengajian").textContent = "Tambah";
  $("tombol-batal-pengajian").hidden = true;
  renderPengajian();
}

function tambahPengajian(e) {
  e.preventDefault();
  const tipe = $("pengajian-tipe").value;
  const jam = $("pengajian-jam").value;
  const nama = $("pengajian-nama").value.trim();
  const pengisi = $("pengajian-pengisi").value.trim();
  if (!jam || !nama) { alert("Jam dan nama kegiatan wajib diisi."); return; }
  const entry = { id: editPengajianId || uid(), tipe, jam, nama, pengisi };
  if (tipe === "mingguan") {
    entry.hari = parseInt($("pengajian-hari").value, 10);
  } else {
    const tanggal = $("pengajian-tanggal").value;
    if (!tanggal) { alert("Tanggal wajib diisi."); return; }
    entry.tanggal = tanggal;
  }
  const arr = loadJadwalPengajian();
  saveJadwalPengajian(
    editPengajianId ? arr.map((x) => (x.id === editPengajianId ? entry : x)) : [...arr, entry]
  );
  batalEditPengajian();
  tampilkanStatus("status-pengajian");
}

// ---------- Jum'at ----------
function renderJumat() {
  $("jumat-menit").value = loadJumatSettings().durasiMenit;
  renderJumatSlides();
}

function simpanJumatSettingsForm(e) {
  e.preventDefault();
  const menit = parseInt($("jumat-menit").value, 10);
  saveJumatSettings({ durasiMenit: Number.isFinite(menit) && menit > 0 ? menit : loadJumatSettings().durasiMenit });
  tampilkanStatus("status-jumat");
}

let editJumatId = null;

function renderJumatSlides() {
  const arr = loadJumatSlides();
  const ul = $("jumat-list");
  ul.innerHTML = "";
  if (!arr.length) { ul.innerHTML = "<li>(belum ada slide)</li>"; return; }
  arr.forEach((s) => {
    const li = document.createElement("li");
    li.classList.toggle("aktif-edit", s.id === editJumatId);
    const thumb = s.tipe === "gambar" ? `<img src="img/${s.file}" alt="" loading="lazy">` : "&#127916;";
    li.innerHTML = `
      <div class="admin-item-thumb">${thumb}</div>
      <div class="admin-item-info">
        <p class="admin-item-judul">${s.file}</p>
        <p class="admin-item-meta">${s.tipe === "video" ? "Video" : "Gambar"} &bull; ${s.durasiDetik} detik</p>
      </div>
      <div class="admin-item-aksi">
        <button type="button" class="btn-inline" data-aksi="edit">Edit</button>
        <button type="button" class="btn-inline btn-bahaya" data-aksi="hapus">Hapus</button>
      </div>
    `;
    li.querySelector('[data-aksi="edit"]').addEventListener("click", () => mulaiEditJumat(s));
    li.querySelector('[data-aksi="hapus"]').addEventListener("click", () => {
      if (!confirm(`Hapus slide "${s.file}"? File akan dihapus permanen dari folder img/.`)) return;
      if (editJumatId === s.id) batalEditJumat();
      hapusJumatSlide(s);
    });
    ul.appendChild(li);
  });
}

function mulaiEditJumat(s) {
  editJumatId = s.id;
  $("jumat-durasi").value = s.durasiDetik;
  $("jumat-file").value = "";
  $("jumat-file").disabled = true;
  $("tombol-tambah-jumat").textContent = "Simpan Durasi";
  $("tombol-batal-jumat").hidden = false;
  renderJumatSlides();
}

function batalEditJumat() {
  editJumatId = null;
  $("jumat-file").disabled = false;
  $("jumat-file").value = "";
  $("jumat-durasi").value = 8;
  $("tombol-tambah-jumat").textContent = "Tambah Slide";
  $("tombol-batal-jumat").hidden = true;
  renderJumatSlides();
}

async function tambahJumatSlide() {
  const durasi = parseInt($("jumat-durasi").value, 10) || 8;
  if (editJumatId) {
    saveJumatSlides(loadJumatSlides().map((x) => (x.id === editJumatId ? { ...x, durasiDetik: durasi } : x)));
    tampilkanStatus("status-jumat-slide");
    batalEditJumat();
    return;
  }
  const file = $("jumat-file").files[0];
  if (!file) { alert("Pilih file dulu."); return; }
  const dirImg = await ambilFolderImg();
  if (!dirImg) { alert("Pilih folder img/ dulu (tombol di sidebar) dan izinkan akses."); return; }
  const tipe = file.type.startsWith("video") ? "video" : "gambar";
  const id = uid();
  const ekstensiMatch = /\.([a-z0-9]+)$/i.exec(file.name);
  const ext = ekstensiMatch ? ekstensiMatch[1].toLowerCase() : (tipe === "video" ? "mp4" : "jpg");
  const nama = `jumat-${id}.${ext}`;
  try {
    const handle = await dirImg.getFileHandle(nama, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
  } catch {
    alert("Gagal menyimpan file ke folder img/.");
    return;
  }
  saveJumatSlides([...loadJumatSlides(), { id, tipe, file: nama, durasiDetik: durasi }]);
  $("jumat-file").value = "";
  tampilkanStatus("status-jumat-slide");
  renderJumatSlides();
}

async function hapusJumatSlide(s) {
  const dirImg = await ambilFolderImg();
  if (dirImg) {
    try { await dirImg.removeEntry(s.file); } catch { /* diam, tetap bersihkan daftar */ }
  }
  saveJumatSlides(loadJumatSlides().filter((x) => x.id !== s.id));
  renderJumatSlides();
}

initFilePicker("murotal");
initFilePicker("nada");
renderIqomah();
renderTampilan();
renderPengumuman();
renderRotasi();
renderTema();
renderAdzan();
renderJumat();
renderFolderStatus();
LAYAR_BG.forEach(renderBgLayar);

$("form-iqomah").addEventListener("submit", simpanIqomah);
$("form-tampilan").addEventListener("submit", simpanTampilan);
$("tombol-tambah-pengumuman").addEventListener("click", tambahBarisPengumuman);
$("form-rotasi").addEventListener("submit", simpanRotasi);
// Stepper +/- generik - dipakai semua panel (termasuk baris dinamis Iqomah,
// asal dirender sebelum baris ini jalan).
document.querySelectorAll(".stepper-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = $(btn.dataset.target);
    const step = parseInt(input.step, 10) || 1;
    input.value = (parseInt(input.value, 10) || 0) + step * Number(btn.dataset.arah);
    clampBarisInput(input);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
});
document.querySelectorAll('.stepper input[type="number"]').forEach((input) => {
  input.addEventListener("change", () => clampBarisInput(input));
});
Object.values(ROTASI_FIELDS).forEach((f) => {
  $(f.input).addEventListener("input", recalcRotasiTimeline);
});
$("form-adzan").addEventListener("submit", simpanAdzanForm);
$("tombol-pilih-folder").addEventListener("click", pilihFolder);
$("form-jumat").addEventListener("submit", simpanJumatSettingsForm);
$("tombol-tambah-jumat").addEventListener("click", tambahJumatSlide);
$("tombol-batal-jumat").addEventListener("click", batalEditJumat);
LAYAR_BG.forEach((layar) => {
  $(`tombol-simpan-bg-${layar}`).addEventListener("click", () => simpanBgLayarForm(layar));
  $(`tombol-hapus-bg-${layar}`).addEventListener("click", () => hapusBgLayarForm(layar));
  $(`form-bg-${layar}`).addEventListener("submit", (e) => {
    e.preventDefault();
    simpanBgLayarForm(layar, { requireFile: false });
  });
});

renderMurotal();
renderQr();
renderPengajian();
muatDaftarSurah();
toggleTipePengajian();

$("form-murotal").addEventListener("submit", simpanMurotal);
$("tombol-tambah-file").addEventListener("click", tambahFileMurotal);
$("tombol-tambah-api").addEventListener("click", tambahApiMurotal);
$("tombol-simpan-nada").addEventListener("click", simpanNada);
$("tombol-hapus-nada").addEventListener("click", hapusNada);
$("tombol-tes-nada").addEventListener("click", tesNada);
$("form-qr").addEventListener("submit", simpanQr);
$("tombol-hapus-qr").addEventListener("click", hapusQr);
$("pengajian-tipe").addEventListener("change", toggleTipePengajian);
$("form-pengajian").addEventListener("submit", tambahPengajian);
$("tombol-batal-pengajian").addEventListener("click", batalEditPengajian);

// ---------- Navigasi sidebar ----------
function setupNavigasi() {
  const items = document.querySelectorAll(".admin-nav-item");
  const panel = (nama) => document.querySelector(`.admin-main [data-panel="${nama}"]`);
  items.forEach((btn) => {
    btn.addEventListener("click", () => {
      const nama = btn.dataset.section;
      items.forEach((b) => b.classList.toggle("aktif", b === btn));
      document.querySelectorAll(".admin-main [data-panel]").forEach((p) => {
        p.hidden = p !== panel(nama);
      });
    });
  });
}
setupNavigasi();

// ---------- Aksi akhir tiap section sidebar: Simpan / Kembali / Preview ----------
// Simpan = submit semua form pengaturan di section itu (form "Tambah" item
// list dikecualikan lewat class .form-tambah-item, itu sudah simpan sendiri
// per klik). Preview = buka layar aslinya di tab baru, coba layar penuh
// otomatis (fullscreen=1, lihat js/fullscreen.js). ?preview=1 pada beberapa
// target memaksa halaman itu tampil dengan data contoh & tidak auto-pulang/
// redirect (lihat js/*.js masing-masing). "Kembali ke Halaman" cukup link
// biasa ke index.html, tidak butuh JS.
function setupSimpanSection() {
  document.querySelectorAll(".tombol-simpan-section").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.closest("[data-panel]");
      const forms = [...section.querySelectorAll("form")].filter((f) => !f.classList.contains("form-tambah-item"));
      for (const f of forms) {
        if (!f.checkValidity()) { f.reportValidity(); return; }
      }
      forms.forEach((f) => f.requestSubmit());
    });
  });
}
setupSimpanSection();

function setupPreviewSection() {
  document.querySelectorAll(".tombol-preview-section").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.dataset.previewSrc;
      const pemisah = src.includes("?") ? "&" : "?";
      window.open(`${src}${pemisah}fullscreen=1&_=${Date.now()}`, "_blank");
    });
  });
}
setupPreviewSection();
