import { SHOLAT, WAKTU_HARIAN, QORI } from "./config.js";
import { loadIqomah, saveIqomah, loadAdzan, saveAdzan, loadHening, saveHening, loadNada, saveNada, loadKoreksiWaktu, saveKoreksiWaktu, resetKoreksiWaktu, loadPengumuman, savePengumuman } from "./settings.js";
import { loadTarawihSettings, saveTarawihSettings, isRamadhanEfektif, tanggalHijriahLabel } from "./ramadhan.js";
import { loadAcara, saveAcara, loadAcaraSlides, saveAcaraSlides } from "./acara-mode.js";
import { loadTampilan, saveTampilan } from "./tampilan.js";
import { loadMurotal, saveMurotal } from "./murotal.js";
import { loadQr, saveQr, clearQr, loadRotasi, saveRotasi } from "./rotasi.js";
import { loadJadwalPengajian, saveJadwalPengajian, daftarOccurrenceSeri, hariDariTanggal } from "./jadwal-pengajian.js";
import { loadJumatSettings, saveJumatSettings, loadJumatSlides, saveJumatSlides } from "./jumat-mode.js";
import { putMedia, delMedia, getMedia } from "./media-db.js";
import { mainkanNada } from "./nada.js";
import { TEMA_TAMPILAN } from "./tema/tampilan/registry.js";
import { simpanBgLayar, hapusBgLayar, urlBgLayar } from "./bg-layar.js";
import { readCache, dateKey, getJadwal } from "./api.js";
import { parseHM, ringkasKoreksiWaktu } from "./waktu.js";
import { cloudAktif, cloudGetAll } from "./cloud.js";
import { cobaUlangPembersihanMedia, hapusMedia, simpanMedia } from "./kelola-media.js";
import { sesiAktif, login, logout } from "./cloud-auth.js";
import { tulisKeLocal } from "./cloud-sync.js";
import { simpanPengaturan, tungguSemuaPengaturan } from "./penyimpanan-pengaturan.js";

const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtJam = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
let jadwalKoreksiHariIni = null;
let sumberJadwalKoreksi = "";

function teksJam(jam) {
  return jam ? `${String(jam).slice(0, 5)} WIB` : "--:-- WIB";
}

function bacaKoreksiForm() {
  const settings = {};
  for (const { key } of SHOLAT) settings[key] = Number($(`koreksi-${key}`)?.value);
  return settings;
}

function renderRingkasanKoreksi() {
  const status = $("status-jadwal-koreksi");
  const ringkasanEl = $("ringkasan-koreksi-waktu");
  if (!ringkasanEl) return;
  ringkasanEl.innerHTML = "";
  if (!jadwalKoreksiHariIni) {
    if (status) status.textContent = "Jadwal sholat hari ini belum tersedia. Koreksi tetap dapat disimpan dan akan berlaku saat jadwal tersedia.";
    const kosong = document.createElement("p");
    kosong.className = "koreksi-ringkasan-kosong";
    kosong.textContent = "Jadwal hari ini belum tersedia.";
    ringkasanEl.appendChild(kosong);
    return;
  }
  if (status) status.textContent = `Jadwal hari ini (${sumberJadwalKoreksi}): ${SHOLAT.map(({ key, label }) => `${label} ${teksJam(jadwalKoreksiHariIni[key])}`).join(" · ")}`;
  const koreksi = bacaKoreksiForm();
  const ringkasan = ringkasKoreksiWaktu(jadwalKoreksiHariIni, koreksi);
  for (const { key, label } of SHOLAT) {
    const waktu = ringkasan[key];
    const menitKoreksi = Number.isFinite(koreksi[key]) ? koreksi[key] : 0;
    const kartu = document.createElement("div");
    kartu.className = "koreksi-waktu-kartu";
    kartu.setAttribute("aria-label", `${label}, ${teksJam(waktu.berlaku)}, koreksi ${menitKoreksi} menit`);
    const judul = document.createElement("span");
    judul.className = "koreksi-waktu-judul";
    judul.textContent = label;
    const nilai = document.createElement("strong");
    nilai.className = "koreksi-waktu-nilai";
    nilai.textContent = teksJam(waktu.berlaku);
    const meta = document.createElement("span");
    meta.className = "koreksi-waktu-meta";
    meta.textContent = `Jadwal ${teksJam(waktu.asli)} · Koreksi ${menitKoreksi > 0 ? "+" : ""}${menitKoreksi} menit`;
    kartu.append(judul, nilai, meta);
    ringkasanEl.appendChild(kartu);
  }
}

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
        <p class="hint-baris">Jeda menit dari azan ke iqomah. Adzan tetap selalu tampil - centang di samping cuma nyalain hitung mundur iqomah setelahnya.</p>
      </div>
      <div class="baris-kaya-kontrol">
        <div class="stepper">
          <button type="button" class="stepper-btn" data-target="menit-${key}" data-arah="-1" aria-label="Kurangi jeda ${label}">&minus;</button>
          <input type="number" min="0" max="60" step="1" id="menit-${key}" value="${s.menit}" inputmode="numeric">
          <span class="stepper-satuan">menit</span>
          <button type="button" class="stepper-btn" data-target="menit-${key}" data-arah="1" aria-label="Tambah jeda ${label}">+</button>
        </div>
        <label class="aktif-cek"><input type="checkbox" id="aktif-${key}" ${s.aktif ? "checked" : ""} aria-label="Iqomah ${label} aktif"></label>
      </div>
    `;
    wrap.appendChild(row);
  }
}

async function simpanIqomah(e) {
  e.preventDefault();
  const settings = {};
  for (const { key } of SHOLAT) {
    const menit = parseInt($(`menit-${key}`).value, 10);
    settings[key] = {
      menit: Number.isFinite(menit) && menit >= 0 ? menit : 0,
      aktif: $(`aktif-${key}`).checked,
    };
  }
  tampilkanStatus("status-simpan", "Menyimpan…", false, true);
  await simpanDenganStatus("status-simpan", e.currentTarget, () => saveIqomah(settings));
}

const IKON_HENING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/></svg>`;

function renderHening() {
  const settings = loadHening();
  const wrap = $("baris-hening");
  wrap.innerHTML = "";
  for (const { key, label } of SHOLAT) {
    const s = settings[key];
    const row = document.createElement("div");
    row.className = "baris-kaya";
    row.innerHTML = `
      <span class="ikon-baris" aria-hidden="true">${IKON_HENING}</span>
      <div class="baris-kaya-teks">
        <label class="label-sholat" for="menit-hening-${key}">${label}</label>
        <p class="hint-baris">Menit layar hening setelah iqomah ${label} kelar.</p>
      </div>
      <div class="baris-kaya-kontrol">
        <div class="stepper">
          <button type="button" class="stepper-btn" data-target="menit-hening-${key}" data-arah="-1" aria-label="Kurangi hening ${label}">&minus;</button>
          <input type="number" min="0" max="60" step="1" id="menit-hening-${key}" value="${s.menit}" inputmode="numeric">
          <span class="stepper-satuan">menit</span>
          <button type="button" class="stepper-btn" data-target="menit-hening-${key}" data-arah="1" aria-label="Tambah hening ${label}">+</button>
        </div>
        <label class="aktif-cek"><input type="checkbox" id="aktif-hening-${key}" ${s.aktif ? "checked" : ""} aria-label="Hening ${label} aktif"></label>
      </div>
    `;
    wrap.appendChild(row);
  }
}

async function simpanHening(e) {
  e.preventDefault();
  const settings = {};
  for (const { key } of SHOLAT) {
    const menit = parseInt($(`menit-hening-${key}`).value, 10);
    settings[key] = {
      menit: Number.isFinite(menit) && menit >= 0 ? menit : 0,
      aktif: $(`aktif-hening-${key}`).checked,
    };
  }
  tampilkanStatus("status-hening", "Menyimpan…", false, true);
  await simpanDenganStatus("status-hening", e.currentTarget, () => saveHening(settings));
}

// Baca dari form langsung (bukan storage) - dipakai buat live-preview status
// pas admin ubah nonaktif/tanggal, SEBELUM diklik Simpan.
function tarawihSettingsDariForm() {
  return {
    ...loadTarawihSettings(),
    tanggalMulai: $("tarawih-tanggal-mulai").value,
    tanggalSelesai: $("tarawih-tanggal-selesai").value,
    nonaktif: $("tarawih-nonaktif").checked,
  };
}

function renderTarawihStatus() {
  const s = tarawihSettingsDariForm();
  const now = new Date();
  const aktif = isRamadhanEfektif(now, s);
  if (s.nonaktif) {
    $("tarawih-status-teks").textContent = `${tanggalHijriahLabel(now)} - Tarawih dimatikan musim ini.`;
    return;
  }
  const modeTeks = s.tanggalMulai && s.tanggalSelesai ? " (pakai tanggal manual)" : " (mengikuti kalender Hijriah)";
  $("tarawih-status-teks").textContent = `${tanggalHijriahLabel(now)} - Ramadhan ${aktif ? "AKTIF" : "tidak aktif"} hari ini${modeTeks}.`;
}

function renderTarawih() {
  const s = loadTarawihSettings();
  $("tarawih-jeda").value = s.jedaMenit;
  $("tarawih-durasi").value = s.durasiMenit;
  $("tarawih-tanggal-mulai").value = s.tanggalMulai;
  $("tarawih-tanggal-selesai").value = s.tanggalSelesai;
  $("tarawih-nonaktif").checked = s.nonaktif;
  renderTarawihStatus();
}

async function simpanTarawihTanggal(e) {
  e.preventDefault();
  const settings = loadTarawihSettings();
  settings.tanggalMulai = $("tarawih-tanggal-mulai").value;
  settings.tanggalSelesai = $("tarawih-tanggal-selesai").value;
  settings.nonaktif = $("tarawih-nonaktif").checked;
  await simpanDenganStatus("status-tarawih", e.currentTarget, () => saveTarawihSettings(settings));
  renderTarawihStatus();
}

async function simpanTarawih(e) {
  e.preventDefault();
  const jeda = parseInt($("tarawih-jeda").value, 10);
  const durasi = parseInt($("tarawih-durasi").value, 10);
  const settings = loadTarawihSettings();
  settings.jedaMenit = Number.isFinite(jeda) && jeda >= 0 ? jeda : 0;
  settings.durasiMenit = Number.isFinite(durasi) && durasi >= 1 ? durasi : 1;
  await simpanDenganStatus("status-tarawih", e.currentTarget, () => saveTarawihSettings(settings));
}

function syncAcaraModeToggle(mode) {
  const waktuAktif = mode !== "selalu";
  $("acara-window-sebelum").hidden = !waktuAktif;
  $("acara-window-sesudah").hidden = !waktuAktif;
}

function renderAcara() {
  const { mode, sebelum, sesudah } = loadAcara();
  document.querySelectorAll('input[name="acara-mode"]').forEach((r) => { r.checked = r.value === mode; });
  syncAcaraModeToggle(mode);
  $("acara-sebelum-aktif").checked = sebelum.aktif;
  $("acara-sebelum-mulai").value = sebelum.mulaiMenit;
  $("acara-sebelum-selesai").value = sebelum.selesaiMenit;
  $("acara-sesudah-aktif").checked = sesudah.aktif;
  $("acara-sesudah-mulai").value = sesudah.mulaiMenit;
  $("acara-sesudah-selesai").value = sesudah.selesaiMenit;
}

async function simpanAcaraMode(e) {
  e.preventDefault();
  const dipilih = document.querySelector('input[name="acara-mode"]:checked');
  const mode = dipilih ? dipilih.value : "waktu";
  const settings = loadAcara();
  settings.mode = mode;
  await simpanDenganStatus("status-acara-mode", e.currentTarget, () => saveAcara(settings));
  syncAcaraModeToggle(mode);
}

async function simpanAcaraSebelum(e) {
  e.preventDefault();
  const mulai = parseInt($("acara-sebelum-mulai").value, 10);
  const selesai = parseInt($("acara-sebelum-selesai").value, 10);
  const settings = loadAcara();
  settings.sebelum = {
    aktif: $("acara-sebelum-aktif").checked,
    mulaiMenit: Number.isFinite(mulai) && mulai >= 0 ? mulai : 0,
    selesaiMenit: Number.isFinite(selesai) && selesai >= 0 ? selesai : 0,
  };
  await simpanDenganStatus("status-acara-sebelum", e.currentTarget, () => saveAcara(settings));
}

async function simpanAcaraSesudah(e) {
  e.preventDefault();
  const mulai = parseInt($("acara-sesudah-mulai").value, 10);
  const selesai = parseInt($("acara-sesudah-selesai").value, 10);
  const settings = loadAcara();
  settings.sesudah = {
    aktif: $("acara-sesudah-aktif").checked,
    mulaiMenit: Number.isFinite(mulai) && mulai >= 0 ? mulai : 0,
    selesaiMenit: Number.isFinite(selesai) && selesai >= 0 ? selesai : 0,
  };
  await simpanDenganStatus("status-acara-sesudah", e.currentTarget, () => saveAcara(settings));
}

function renderTampilan() {
  const t = loadTampilan();
  $("tampilan-header").checked = t.header;
  $("tampilan-maklumat").checked = t.maklumat;
}

async function simpanTampilan(e) {
  e.preventDefault();
  await simpanDenganStatus("status-tampilan", e.currentTarget, () => saveTampilan({
    header: $("tampilan-header").checked,
    maklumat: $("tampilan-maklumat").checked,
  }));
}

function renderKoreksiWaktu() {
  const settings = loadKoreksiWaktu();
  const wrap = $("baris-koreksi-waktu");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const { key, label } of SHOLAT) {
    const row = document.createElement("div");
    row.className = "baris-kaya";
    row.innerHTML = `
      <span class="ikon-baris" aria-hidden="true">${IKON_IQOMAH}</span>
      <div class="baris-kaya-teks">
        <label class="label-sholat" for="koreksi-${key}">${label}</label>
      </div>
      <div class="stepper koreksi-stepper">
        <button type="button" class="stepper-btn" data-target="koreksi-${key}" data-arah="-1" aria-label="Kurangi koreksi ${label}">&minus;</button>
        <input type="number" min="-30" max="30" step="1" id="koreksi-${key}" value="${settings[key]}" inputmode="numeric" aria-label="Koreksi waktu ${label}">
        <span class="stepper-satuan">menit</span>
        <button type="button" class="stepper-btn" data-target="koreksi-${key}" data-arah="1" aria-label="Tambah koreksi ${label}">+</button>
      </div>
    `;
    wrap.appendChild(row);
    row.querySelector(`#koreksi-${key}`).addEventListener("input", renderRingkasanKoreksi);
  }
  renderRingkasanKoreksi();
}

async function simpanKoreksiWaktu(e) {
  e.preventDefault();
  const settings = {};
  for (const { key } of SHOLAT) settings[key] = Number($(`koreksi-${key}`).value);
  await simpanDenganStatus("status-koreksi-waktu", e.currentTarget, () => saveKoreksiWaktu(settings));
  renderKoreksiWaktu();
}

async function resetKoreksiWaktuForm() {
  await simpanDenganStatus("status-koreksi-waktu", $("form-koreksi-waktu"), () => resetKoreksiWaktu());
  renderKoreksiWaktu();
}

async function muatJadwalKoreksiHariIni() {
  const sekarang = new Date();
  const cache = readCache();
  if (cache && cache.dateKey === dateKey(sekarang) && cache.jadwal) {
    jadwalKoreksiHariIni = cache.jadwal;
    sumberJadwalKoreksi = "cache lokal";
    renderRingkasanKoreksi();
  }
  try {
    const hasil = await getJadwal(sekarang);
    jadwalKoreksiHariIni = hasil.jadwal;
    sumberJadwalKoreksi = hasil.fromCache ? "cache lokal/offline" : "API";
  } catch {
    sumberJadwalKoreksi = "belum tersedia";
  }
  renderRingkasanKoreksi();
}

const IKON_EDIT_PENGUMUMAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
const IKON_HAPUS_PENGUMUMAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="m6 7 1 13h10l1-13M9 7V4h6v3"/></svg>';
const IKON_SELESAI_PENGUMUMAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const IKON_BATAL_PENGUMUMAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function buatTombolIkonPengumuman(className, label, icon) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `pengumuman-action ${className}`;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

async function simpanDaftarPengumuman(arr, form) {
  return simpanDenganStatus("status-pengumuman", form, () => savePengumuman(arr));
}

function buatBarisPengumuman(teks, index) {
  const li = document.createElement("li");
  li.className = "pengumuman-item";

  const tampilan = document.createElement("div");
  tampilan.className = "pengumuman-tampilan";
  const isi = document.createElement("span");
  isi.className = "pengumuman-teks";
  isi.textContent = teks;
  const aksi = document.createElement("div");
  aksi.className = "pengumuman-aksi";
  const edit = buatTombolIkonPengumuman("pengumuman-edit", "Edit pesan", IKON_EDIT_PENGUMUMAN);
  const hapus = buatTombolIkonPengumuman("pengumuman-hapus", "Hapus pesan", IKON_HAPUS_PENGUMUMAN);

  const form = document.createElement("form");
  form.className = "pengumuman-edit-form";
  form.hidden = true;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "pengumuman-input";
  input.placeholder = "Tulis pesan...";
  input.value = teks;
  input.required = true;
  input.setAttribute("aria-label", `Edit pesan ${index + 1}`);
  const simpan = buatTombolIkonPengumuman("pengumuman-simpan", "Simpan pesan", IKON_SELESAI_PENGUMUMAN);
  simpan.type = "submit";
  const batal = buatTombolIkonPengumuman("pengumuman-batal", "Batal edit pesan", IKON_BATAL_PENGUMUMAN);

  edit.addEventListener("click", () => {
    tampilan.hidden = true;
    form.hidden = false;
    input.focus();
    input.select();
  });
  batal.addEventListener("click", () => {
    tampilan.hidden = false;
    form.hidden = true;
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nilai = input.value.trim();
    if (!nilai) { input.focus(); return; }
    const arr = [...loadPengumuman()];
    if (index < arr.length) arr[index] = nilai;
    await simpanDaftarPengumuman(arr, form);
    renderPengumuman();
  });
  hapus.addEventListener("click", async () => {
    const arr = [...loadPengumuman()];
    arr.splice(index, 1);
    await simpanDaftarPengumuman(arr);
    renderPengumuman();
  });

  aksi.append(edit, hapus);
  tampilan.append(isi, aksi);
  form.append(input, simpan, batal);
  li.append(tampilan, form);
  return li;
}

function renderPengumuman() {
  const ul = $("pengumuman-list");
  ul.innerHTML = "";
  const daftar = loadPengumuman();
  if (!daftar.length) {
    const kosong = document.createElement("li");
    kosong.className = "pengumuman-kosong";
    kosong.textContent = "Belum ada pesan.";
    ul.appendChild(kosong);
    return;
  }
  daftar.forEach((teks, index) => ul.appendChild(buatBarisPengumuman(teks, index)));
}

async function tambahPengumuman(e) {
  e.preventDefault();
  const input = $("pengumuman-baru");
  const teks = input.value.trim();
  if (!teks) return;
  await simpanDaftarPengumuman([...loadPengumuman(), teks], e.currentTarget);
  input.value = "";
  renderPengumuman();
  input.focus();
}

const ROTASI_FIELDS = {
  sholat: { input: "rotasi-sholat", segmen: "segmen-sholat", nilai: "segmen-sholat-nilai" },
  qr: { input: "rotasi-qr", segmen: "segmen-qr", nilai: "segmen-qr-nilai" },
  kegiatan: { input: "rotasi-kegiatan", segmen: "segmen-kegiatan", nilai: "segmen-kegiatan-nilai" },
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

async function simpanRotasi(e) {
  e.preventDefault();
  const angka = (val, def) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  tampilkanStatus("status-rotasi", "Menyimpan…", false, true);
  await simpanDenganStatus("status-rotasi", e.currentTarget, () => saveRotasi({
    sholatDetik: angka($("rotasi-sholat").value, 60),
    jadwalPengajianDetik: angka($("rotasi-kegiatan").value, 20),
    qrDonasiDetik: angka($("rotasi-qr").value, 15),
  }));
}

function tampilkanStatus(id, teks, peringatan = false, tetap = false) {
  const el = $(id);
  if (teks) el.textContent = teks;
  el.classList.toggle("status-warn", peringatan);
  clearTimeout(el._timerStatus);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("tampil"));
  if (tetap) return;
  el._timerStatus = setTimeout(() => {
    el.classList.remove("tampil");
    setTimeout(() => { el.hidden = true; }, 200);
  }, 2000);
}

function tampilkanHasilSimpan(id, hasil) {
  if (!hasil.lokal) {
    tampilkanStatus(id, "Pengaturan berhasil diperbarui, tetapi penyimpanan perangkat penuh. Kosongkan penyimpanan browser agar perubahan tetap tersedia tanpa koneksi.", true, true);
  } else if (hasil.tertunda) {
    tampilkanStatus(id, "Pengaturan berhasil disimpan. Koneksi sedang bermasalah, perubahan akan diperbarui otomatis saat koneksi kembali.", true, true);
  } else {
    tampilkanStatus(id, "Tersimpan.");
  }
}

async function simpanDenganStatus(id, form, aksi) {
  const tombol = form?.querySelector('[type="submit"]');
  if (tombol?.disabled) return null;
  if (tombol) tombol.disabled = true;
  tampilkanStatus(id, "Menyimpan…", false, true);
  try {
    const hasil = await aksi();
    tampilkanHasilSimpan(id, hasil);
    return hasil;
  } finally {
    if (tombol) tombol.disabled = false;
  }
}

// ---------- Adzan ----------
function renderAdzan() {
  $("adzan-menit").value = loadAdzan().menit;
}

async function simpanAdzanForm(e) {
  e.preventDefault();
  const menit = parseInt($("adzan-menit").value, 10);
  tampilkanStatus("status-adzan", "Menyimpan…", false, true);
  await simpanDenganStatus("status-adzan", e.currentTarget, () => saveAdzan({ menit: Number.isFinite(menit) && menit >= 0 ? menit : 0 }));
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
  const hasil = await simpanBgLayar(layar, file);
  if (!hasil || !hasil.ok) { alert("Gagal menyimpan. Pastikan cloud sudah dikonfigurasi (lihat js/supabase-config.js)."); return; }
  $(`${layar}-bg-file`).value = "";
  renderBgLayar(layar);
  tampilkanStatus(`status-bg-${layar}`, hasil.pembersihanTertunda ? "Latar diperbarui. File lama akan dibersihkan otomatis." : "Tersimpan.", !!hasil.pembersihanTertunda, !!hasil.pembersihanTertunda);
}

async function hapusBgLayarForm(layar) {
  if (!confirm("Hapus foto latar ini?")) return;
  const hasil = await hapusBgLayar(layar);
  renderBgLayar(layar);
  tampilkanStatus(`status-bg-${layar}`, hasil?.pembersihanTertunda ? "Latar dihapus. File lama akan dibersihkan otomatis." : "Tersimpan.", !!hasil?.pembersihanTertunda, !!hasil?.pembersihanTertunda);
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
    row.querySelector("input").addEventListener("change", renderMurotalPreview);
    wrap.appendChild(row);
  }
  renderPlaylist();
  renderMurotalPreview();
}

// Cegah "Berhenti" lewat/samain "Mulai" langsung di stepper (dulu cuma
// ketauan lewat alert pas Simpan) - dorong field satunya biar urutan waktu
// selalu masuk akal (start harus lebih jauh dari adzan daripada end).
function enforceMurotalOrder(sourceId) {
  const mulaiInput = $("murotal-mulai");
  const berhentiInput = $("murotal-berhenti");
  let mulai = parseInt(mulaiInput.value, 10);
  let berhenti = parseInt(berhentiInput.value, 10);
  if (berhenti < mulai) return;
  if (sourceId === "murotal-berhenti") {
    mulai = Math.min(berhenti + 1, parseInt(mulaiInput.max, 10));
    berhenti = Math.min(berhenti, mulai - 1);
    mulaiInput.value = mulai;
    berhentiInput.value = berhenti;
  } else {
    berhenti = Math.max(mulai - 1, parseInt(berhentiInput.min, 10));
    mulaiInput.value = mulai;
    berhentiInput.value = berhenti;
  }
}

// Pratinjau jam nyata "Subuh 04:12 -> 03:57-04:12" biar admin tidak perlu
// hitung sendiri offset menit ke jam sholat. Pakai cache jadwal hari ini
// yang sudah ditulis halaman utama (js/api.js) - tidak fetch API sendiri.
function renderMurotalPreview() {
  const el = $("murotal-preview-jam");
  if (!el) return;
  const mulai = parseInt($("murotal-mulai").value, 10);
  const berhenti = parseInt($("murotal-berhenti").value, 10);
  const pesan = (teks) => { el.innerHTML = `<li class="timing-preview-pesan">${teks}</li>`; };
  const cache = readCache();
  if (!cache || !cache.jadwal || cache.dateKey !== dateKey(new Date())) {
    pesan("Buka halaman utama sekali dulu supaya jadwal sholat hari ini tersedia untuk pratinjau jam.");
    return;
  }
  const aktif = SHOLAT.filter(({ key }) => $(`murotal-sholat-${key}`)?.checked);
  if (!aktif.length) {
    pesan("Belum ada waktu sholat yang dipilih di atas.");
    return;
  }
  el.innerHTML = aktif
    .filter(({ key }) => cache.jadwal[key])
    .map(({ key, label }) => {
      const adzan = parseHM(cache.jadwal[key], new Date());
      const start = fmtJam(new Date(adzan.getTime() - mulai * 60000));
      const end = fmtJam(new Date(adzan.getTime() - berhenti * 60000));
      return `<li class="timing-preview-baris">
        <span class="timing-preview-nama">${label}</span>
        <span class="timing-preview-adzan">adzan ${cache.jadwal[key]}</span>
        <span class="timing-preview-rentang">${start}–${end}</span>
      </li>`;
    })
    .join("");
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
      if (item.tipe === "offline" && !(await delMedia(item.mediaKey))) {
        alert("Gagal menghapus audio. File lama tetap dipertahankan agar semua kiosk konsisten.");
        return;
      }
      cur.playlist = cur.playlist.filter((p) => p.id !== item.id);
      if (cur.posisi.index >= cur.playlist.length) cur.posisi = { index: 0, detik: 0 };
      await simpanDenganStatus("status-murotal", null, () => saveMurotal(cur));
      if (trackAktifId === item.id) trackAktifId = null;
      renderPlaylist();
    });
    ul.appendChild(li);
  });
}

async function simpanMurotal(e) {
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
  await simpanDenganStatus("status-murotal", e.currentTarget, () => saveMurotal(s));
}

async function tambahFileMurotal() {
  const file = $("murotal-file").files[0];
  if (!file) return;
  const mediaKey = "murotal:" + uid();
  const ok = await putMedia(mediaKey, file);
  if (!ok) { alert("Gagal menyimpan file (IndexedDB tidak tersedia)."); return; }
  const s = loadMurotal();
  s.playlist.push({ id: uid(), tipe: "offline", label: file.name, mediaKey });
  await simpanDenganStatus("status-murotal", null, () => saveMurotal(s));
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

async function tambahApiMurotal() {
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
  await simpanDenganStatus("status-murotal", null, () => saveMurotal(s));
  renderPlaylist();
}

// ---------- Nada Iqomah & Sholat Mode ----------
function renderNada() {
  const s = loadNada();
  $("nada-iqomah-detik").value = s.iqomahDetik;
  $("nada-sholat-mode-detik").value = s.sholatModeDetik;
}

function bacaDurasiNada(id, fallback) {
  const nilai = parseInt($(id).value, 10);
  return Number.isFinite(nilai) && nilai > 0 ? Math.min(nilai, 120) : fallback;
}

async function simpanNadaForm(e, { mediaKey, fileId, durasiId, settingKey, statusId }) {
  e.preventDefault();
  const settings = loadNada();
  settings[settingKey] = bacaDurasiNada(durasiId, settings[settingKey]);

  const file = $(fileId).files[0];
  if (file) {
    const ok = await putMedia(mediaKey, file);
    if (!ok) { alert("Gagal menyimpan audio. Pastikan penyimpanan browser tersedia."); return; }
    $(fileId).value = "";
    $(fileId).dispatchEvent(new Event("change"));
  }
  await simpanDenganStatus(statusId, e.currentTarget, () => saveNada(settings));
}

async function hapusNada(mediaKey, statusId, nama) {
  if (!confirm(`Hapus nada ${nama} ini? Layar akan pakai beep default.`)) return;
  if (!(await delMedia(mediaKey))) {
    tampilkanStatus(statusId, "Gagal menghapus audio. Nada lama tetap dipertahankan agar semua kiosk konsisten.", true, true);
    return;
  }
  tampilkanStatus(statusId);
}

function tesNada(audioId, mediaKey, settingKey) {
  const settings = loadNada();
  mainkanNada($(audioId), { mediaKey, durasiDetik: settings[settingKey] });
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
  const pengumuman = document.querySelector(".admin-jadwal-announcements");
  if (pengumuman) pengumuman.hidden = !( $("tampilan-maklumat")?.checked );
}

// KEY_TEMA_TAMPILAN dulunya raw string (bukan JSON) - sekarang di-JSON.stringify
// biar konsisten sama setting lain (tulisKeLocal cloud-sync.js selalu
// JSON.stringify pas tarik dari cloud). try/catch jaga kompatibel kalau
// masih ada nilai lama format raw tersisa di device/cloud.
function bacaTemaTampilan() {
  const raw = localStorage.getItem(KEY_TEMA_TAMPILAN);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}
function simpanTemaTampilan(id) {
  return simpanPengaturan(KEY_TEMA_TAMPILAN, id);
}

// Idempoten (fieldset dikosongkan dulu) - dipanggil ulang setelah
// tarikUlangDariCloud(), bukan cuma sekali saat load.
function renderTema() {
  const fieldset = document.querySelector(`[data-tema-kartu="tampilan"]`);
  fieldset.innerHTML = "";
  const tersimpan = bacaTemaTampilan();
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
}

// ---------- QR Donasi ----------
function renderQr() {
  const q = loadQr();
  if (q) {
    $("qr-judul").value = q.judul || "";
    $("qr-teks").value = q.teks || "";
    $("qr-preview").src = q.urlCloud || q.dataUrl;
    $("qr-preview").hidden = false;
  }
}

async function simpanQr(e) {
  e.preventDefault();
  const file = $("qr-file").files[0];
  const judul = $("qr-judul").value.trim();
  const teks = $("qr-teks").value.trim();
  const simpanObj = async (obj) => {
    const hasil = await saveQr(obj);
    if (!hasil.lokal && !hasil.cloud?.ok) { alert("Gambar terlalu besar untuk disimpan. Pakai gambar QR yang lebih kecil."); return; }
    $("qr-preview").src = obj.urlCloud || obj.dataUrl;
    $("qr-preview").hidden = false;
    tampilkanHasilSimpan("status-qr", hasil);
  };
  if (file) {
    if (cloudAktif()) {
      const ekstensi = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() || "png";
      const lama = loadQr();
      const hasil = await simpanMedia({
        file,
        nama: `qr-donasi.${ekstensi}`,
        mediaLama: lama?.urlCloud,
        buatMetadata: (urlCloud) => ({ urlCloud, judul, teks }),
        simpanMetadata: saveQr,
      });
      if (!hasil.ok) { alert("Gagal menyimpan QR dan metadata."); return; }
      $("qr-preview").src = loadQr()?.urlCloud || "";
      $("qr-preview").hidden = false;
      tampilkanStatus("status-qr", hasil.pembersihanTertunda ? "QR diperbarui. File lama akan dibersihkan otomatis." : "Tersimpan.", !!hasil.pembersihanTertunda, !!hasil.pembersihanTertunda);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => alert("Gagal membaca file gambar.");
    reader.onload = () => simpanObj({ dataUrl: reader.result, judul, teks });
    reader.readAsDataURL(file);
  } else {
    const q = loadQr();
    if (!q) { alert("Pilih gambar QR dulu."); return; }
    await simpanObj({ ...q, judul, teks });
  }
}
async function hapusQr() {
  if (!confirm("Hapus QR donasi ini?")) return;
  const q = loadQr();
  const hasil = q?.urlCloud
    ? await hapusMedia({ media: q.urlCloud, buatMetadata: () => ({}), simpanMetadata: clearQr })
    : await clearQr();
  $("qr-preview").hidden = true;
  $("qr-judul").value = "";
  $("qr-teks").value = "";
  $("qr-file").value = "";
  tampilkanStatus("status-qr", hasil?.pembersihanTertunda ? "QR dihapus. File lama akan dibersihkan otomatis." : "Tersimpan.", !!hasil?.pembersihanTertunda, !!hasil?.pembersihanTertunda);
}

// ---------- Jadwal Pengajian ----------
// Dua sub-form, tergantung tipe kegiatan:
// - "tanggal" (sekali tampil): repeater, 1 baris = 1 jadwal, mode tambah bisa
//   isi banyak baris sekaligus (judul/pengisi beda-beda per baris).
// - "mingguan" (seri berulang): tanggal mulai menentukan hari pengulangan
//   (dideteksi otomatis, bukan input terpisah, biar tanggal & hari gak pernah
//   kontradiksi), admin pilih kapan seri berakhir + opsional daftar pengisi
//   bergilir (round-robin), lalu tabel pratinjau per-tanggal yang bisa
//   diedit/dikecualikan satu-satu tanpa membatalkan seluruh seri.
const HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_NAMA = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

let editPengajianId = null;

// ===== Tanggal khusus: repeater =====
function buatBarisJadwal(nilai = {}) {
  const div = document.createElement("div");
  div.className = "jadwal-baris-item";
  div.innerHTML = `
    <button type="button" class="jadwal-baris-hapus" aria-label="Hapus baris ini">&times;</button>
    <div class="jbm-tanggal"><label>Tanggal</label><input type="date" class="jbm-input" data-field="tanggal"></div>
    <div class="jbm-jam"><label>Jam (opsional)</label><input type="time" class="jbm-input" data-field="jam"></div>
    <div class="jbm-nama"><label>Nama kegiatan</label><input type="text" class="jbm-input" data-field="nama" placeholder="Kajian Subuh"></div>
    <div class="jbm-pengisi"><label>Pengisi (opsional)</label><input type="text" class="jbm-input" data-field="pengisi" placeholder="Ust. Fulan"></div>
  `;
  div.querySelector('[data-field="tanggal"]').value = nilai.tanggal || "";
  div.querySelector('[data-field="jam"]').value = nilai.jam || "";
  div.querySelector('[data-field="nama"]').value = nilai.nama || "";
  div.querySelector('[data-field="pengisi"]').value = nilai.pengisi || "";
  div.querySelector(".jadwal-baris-hapus").addEventListener("click", () => {
    div.remove();
    perbaruiTombolHapusBaris();
  });
  return div;
}

function perbaruiTombolHapusBaris() {
  const baris = [...document.querySelectorAll("#daftar-baris-jadwal .jadwal-baris-item")];
  baris.forEach((b) => { b.querySelector(".jadwal-baris-hapus").hidden = baris.length <= 1; });
}

function tambahBarisJadwal(nilai) {
  const baris = buatBarisJadwal(nilai);
  $("daftar-baris-jadwal").appendChild(baris);
  perbaruiTombolHapusBaris();
  return baris;
}

function resetBarisJadwal() {
  $("daftar-baris-jadwal").innerHTML = "";
  tambahBarisJadwal({});
}

function bacaBarisJadwal(baris) {
  const field = (nama) => baris.querySelector(`[data-field="${nama}"]`);
  return {
    tanggal: field("tanggal").value,
    jam: field("jam").value.trim(),
    nama: field("nama").value.trim(),
    pengisi: field("pengisi").value.trim(),
  };
}

// ===== Mingguan: seri berulang =====
// override tersimpan per-tanggal (bukan per-baris-form) - dipertahankan
// lintas render ulang tabel supaya edit pengisi/kecualikan admin gak hilang
// waktu field lain (misal akhir seri) diubah.
let mgOverride = {};

function mgAmbilForm() {
  const akhirJenis = $("mg-akhir-jenis").value;
  const akhir = akhirJenis === "tanggal"
    ? { jenis: "tanggal", sampai: $("mg-akhir-tanggal").value }
    : akhirJenis === "jumlah"
    ? { jenis: "jumlah", n: Math.max(1, parseInt($("mg-akhir-jumlah").value, 10) || 1) }
    : { jenis: "tanpa-batas" };
  const rotasiPengisi = $("mg-rotasi-aktif").checked
    ? $("mg-rotasi-daftar").value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    nama: $("mg-nama").value.trim(),
    jam: $("mg-jam").value,
    tanggalMulai: $("mg-tanggal-mulai").value,
    akhir,
    rotasiPengisi,
    override: mgOverride,
  };
}

function mgRenderTabel() {
  const tanggalMulai = $("mg-tanggal-mulai").value;
  $("mg-hari-konfirmasi").textContent = tanggalMulai
    ? `Hari pengulangan: ${HARI_NAMA[hariDariTanggal(tanggalMulai)]}`
    : "Hari pengulangan: -";

  const tbody = $("mg-tabel-body");
  tbody.innerHTML = "";
  const daftar = tanggalMulai ? daftarOccurrenceSeri(mgAmbilForm(), 12) : [];
  $("mg-tabel-wrap").hidden = daftar.length === 0;
  $("mg-tabel-kosong").hidden = daftar.length !== 0;

  daftar.forEach((occ) => {
    const tr = document.createElement("tr");
    tr.className = occ.dikecualikan ? "mg-row-dikecualikan" : "";

    const tdTgl = document.createElement("td");
    tdTgl.className = "mg-tabel-tanggal";
    tdTgl.textContent = `${HARI_NAMA[occ.tanggal.getDay()]}, ${occ.tanggal.getDate()} ${BULAN_NAMA[occ.tanggal.getMonth()]} ${occ.tanggal.getFullYear()}`;

    const tdJam = document.createElement("td");
    const inpJam = document.createElement("input");
    inpJam.type = "time";
    inpJam.value = occ.jam;
    inpJam.addEventListener("input", () => {
      mgOverride[occ.tanggalStr] = { ...mgOverride[occ.tanggalStr], jam: inpJam.value };
    });
    tdJam.appendChild(inpJam);

    const tdPengisi = document.createElement("td");
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = occ.pengisi;
    inp.placeholder = "Belum ditentukan";
    inp.setAttribute("list", "mg-datalist-pengisi");
    inp.className = occ.pengisi ? "" : "mg-belum-ditentukan";
    inp.addEventListener("input", () => {
      mgOverride[occ.tanggalStr] = { ...mgOverride[occ.tanggalStr], pengisi: inp.value.trim() };
      inp.classList.toggle("mg-belum-ditentukan", !inp.value.trim());
    });
    tdPengisi.appendChild(inp);

    const tdAksi = document.createElement("td");
    const btnEx = document.createElement("button");
    btnEx.type = "button";
    btnEx.className = "btn-inline";
    btnEx.textContent = occ.dikecualikan ? "Sertakan" : "Kecualikan";
    btnEx.addEventListener("click", () => {
      mgOverride[occ.tanggalStr] = { ...mgOverride[occ.tanggalStr], dikecualikan: !occ.dikecualikan };
      mgRenderTabel();
    });
    tdAksi.appendChild(btnEx);

    tr.append(tdTgl, tdJam, tdPengisi, tdAksi);
    tbody.appendChild(tr);
  });
}

function mgResetForm() {
  mgOverride = {};
  $("mg-nama").value = "";
  $("mg-jam").value = "";
  $("mg-tanggal-mulai").value = "";
  $("mg-akhir-jenis").value = "tanpa-batas";
  $("mg-akhir-tanggal").value = "";
  $("mg-akhir-jumlah").value = "10";
  $("mg-akhir-tanggal-wrap").hidden = true;
  $("mg-akhir-jumlah-wrap").hidden = true;
  $("mg-rotasi-aktif").checked = false;
  $("mg-rotasi-wrap").hidden = true;
  $("mg-rotasi-daftar").value = "";
  mgRenderTabel();
}

function mgIsiForm(series) {
  mgOverride = JSON.parse(JSON.stringify(series.override || {}));
  $("mg-nama").value = series.nama || "";
  $("mg-jam").value = series.jam || "";
  $("mg-tanggal-mulai").value = series.tanggalMulai || "";
  const akhir = series.akhir || { jenis: "tanpa-batas" };
  $("mg-akhir-jenis").value = akhir.jenis;
  $("mg-akhir-tanggal-wrap").hidden = akhir.jenis !== "tanggal";
  $("mg-akhir-jumlah-wrap").hidden = akhir.jenis !== "jumlah";
  $("mg-akhir-tanggal").value = akhir.jenis === "tanggal" ? akhir.sampai || "" : "";
  $("mg-akhir-jumlah").value = akhir.jenis === "jumlah" ? akhir.n : 10;
  const rotasiAktif = !!(series.rotasiPengisi && series.rotasiPengisi.length);
  $("mg-rotasi-aktif").checked = rotasiAktif;
  $("mg-rotasi-wrap").hidden = !rotasiAktif;
  $("mg-rotasi-daftar").value = (series.rotasiPengisi || []).join(", ");
  mgRenderTabel();
}

// Nama pengisi yg pernah dipakai (tanggal khusus + rotasi/override mingguan) - buat autocomplete.
function daftarNamaPengisi() {
  const set = new Set();
  loadJadwalPengajian().forEach((e) => {
    if (e.tipe === "tanggal" && e.pengisi) set.add(e.pengisi);
    if (e.tipe === "mingguan") {
      (e.rotasiPengisi || []).forEach((p) => p && set.add(p));
      Object.values(e.override || {}).forEach((ov) => ov.pengisi && set.add(ov.pengisi));
    }
  });
  return [...set].sort();
}

function renderDatalistPengisi() {
  const dl = $("mg-datalist-pengisi");
  dl.innerHTML = "";
  daftarNamaPengisi().forEach((nama) => {
    const opt = document.createElement("option");
    opt.value = nama;
    dl.appendChild(opt);
  });
}

function deskripsiAkhirSeri(akhir) {
  if (akhir.jenis === "tanggal") return `s.d. ${akhir.sampai}`;
  if (akhir.jenis === "jumlah") return `${akhir.n}x pertemuan`;
  return "tanpa batas";
}

// ===== Bersama =====
function toggleTipePengajian() {
  const tipe = $("pengajian-tipe").value;
  $("blok-tanggal").hidden = tipe !== "tanggal";
  $("blok-mingguan").hidden = tipe !== "mingguan";
  $("tombol-tambah-baris").hidden = !!editPengajianId;
  if (editPengajianId) return; // field sudah diisi manual oleh mulaiEditPengajian - jangan direset
  if (tipe === "tanggal") resetBarisJadwal(); else mgResetForm();
}

// Tabel read-only semua tanggal seri (bukan buat diedit - itu tugas form
// Edit; ini cuma buat admin ngintip cepat tanpa buka form) - dropdown di
// bawah baris list, dipicu tombol "Detail".
function renderTabelDetailSeri(series) {
  const daftar = daftarOccurrenceSeri(series, 60);
  if (!daftar.length) {
    return '<p class="hint-baris">Belum ada tanggal (seri belum mulai atau sudah berakhir).</p>';
  }
  const baris = daftar.map((occ) => `
    <tr class="${occ.dikecualikan ? "mg-row-dikecualikan" : ""}">
      <td class="mg-tabel-tanggal">${HARI_NAMA[occ.tanggal.getDay()]}, ${occ.tanggal.getDate()} ${BULAN_NAMA[occ.tanggal.getMonth()]} ${occ.tanggal.getFullYear()}</td>
      <td>${occ.jam || "-"}</td>
      <td>${occ.pengisi || "Belum ditentukan"}</td>
    </tr>
  `).join("");
  return `
    <div class="mg-tabel-wrap">
      <table class="mg-tabel">
        <thead><tr><th>Tanggal</th><th>Jam</th><th>Pengisi</th></tr></thead>
        <tbody>${baris}</tbody>
      </table>
    </div>
  `;
}

function renderPengajian() {
  const arr = loadJadwalPengajian();
  const ul = $("pengajian-list");
  ul.innerHTML = "";
  if (!arr.length) { ul.innerHTML = "<li>(belum ada jadwal)</li>"; return; }
  arr.forEach((e) => {
    const jamTeks = e.jam ? ` ${e.jam}` : "";
    // e.tanggalMulai bisa kosong utk entri lama (format sblm ada seri berulang) - jangan crash, tandai aja.
    const kapan = e.tipe === "mingguan"
      ? (e.tanggalMulai
          ? `Mulai ${e.tanggalMulai} (${HARI_NAMA[hariDariTanggal(e.tanggalMulai)]})${jamTeks} - ${deskripsiAkhirSeri(e.akhir || { jenis: "tanpa-batas" })}`
          : "(format lama - edit ulang atau hapus)")
      : `${e.tanggal}${jamTeks}`;
    const pengisiTeks = e.tipe === "mingguan"
      ? (e.rotasiPengisi && e.rotasiPengisi.length ? e.rotasiPengisi.join(" -> ") : "")
      : (e.pengisi || "");
    const bisaDetail = e.tipe === "mingguan" && !!e.tanggalMulai;
    const li = document.createElement("li");
    li.classList.toggle("aktif-edit", e.id === editPengajianId);
    li.innerHTML = `
      <div class="admin-item-row">
        <div class="admin-item-info">
          <p class="admin-item-judul">${e.nama}</p>
          <p class="admin-item-meta">${kapan}${pengisiTeks ? " &bull; " + pengisiTeks : ""}</p>
        </div>
        <div class="admin-item-aksi">
          ${bisaDetail ? '<button type="button" class="btn-inline" data-aksi="detail">Detail</button>' : ""}
          <button type="button" class="btn-inline" data-aksi="edit">Edit</button>
          <button type="button" class="btn-inline btn-bahaya" data-aksi="hapus">Hapus</button>
        </div>
      </div>
      ${bisaDetail ? '<div class="mg-detail-panel" hidden></div>' : ""}
    `;
    li.querySelector('[data-aksi="edit"]').addEventListener("click", () => mulaiEditPengajian(e));
    li.querySelector('[data-aksi="hapus"]').addEventListener("click", async () => {
      if (!confirm(`Hapus kegiatan "${e.nama}"?`)) return;
      await simpanDenganStatus("status-pengajian", null, () => saveJadwalPengajian(loadJadwalPengajian().filter((x) => x.id !== e.id)));
      if (editPengajianId === e.id) batalEditPengajian();
      renderPengajian();
    });
    if (bisaDetail) {
      const btnDetail = li.querySelector('[data-aksi="detail"]');
      const panel = li.querySelector(".mg-detail-panel");
      btnDetail.addEventListener("click", () => {
        const buka = panel.hidden;
        if (buka && !panel.dataset.terisi) {
          panel.innerHTML = renderTabelDetailSeri(e);
          panel.dataset.terisi = "1";
        }
        panel.hidden = !buka;
        btnDetail.textContent = buka ? "Tutup" : "Detail";
      });
    }
    ul.appendChild(li);
  });
}

function mulaiEditPengajian(e) {
  editPengajianId = e.id;
  $("pengajian-tipe").value = e.tipe;
  toggleTipePengajian();
  if (e.tipe === "tanggal") {
    $("daftar-baris-jadwal").innerHTML = "";
    tambahBarisJadwal(e);
  } else {
    mgIsiForm(e);
  }
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

async function tambahPengajian(e) {
  e.preventDefault();
  const tipe = $("pengajian-tipe").value;
  let daftarBaru;

  if (tipe === "tanggal") {
    const baris = [...document.querySelectorAll("#daftar-baris-jadwal .jadwal-baris-item")].map(bacaBarisJadwal);
    const buatEntry = (id, b) => ({ id, tipe, jam: b.jam, nama: b.nama, pengisi: b.pengisi, tanggal: b.tanggal });
    if (editPengajianId) {
      const b = baris[0];
      if (!b.nama) { alert("Nama kegiatan wajib diisi."); return; }
      if (!b.tanggal) { alert("Tanggal wajib diisi."); return; }
      daftarBaru = loadJadwalPengajian().map((x) => (x.id === editPengajianId ? buatEntry(editPengajianId, b) : x));
    } else {
      const isi = baris.filter((b) => b.nama);
      if (!isi.length) { alert("Nama kegiatan wajib diisi minimal satu baris."); return; }
      if (isi.some((b) => !b.tanggal)) { alert("Tanggal wajib diisi tiap baris."); return; }
      daftarBaru = [...loadJadwalPengajian(), ...isi.map((b) => buatEntry(uid(), b))];
    }
  } else {
    const series = mgAmbilForm();
    if (!series.nama) { alert("Nama kegiatan wajib diisi."); return; }
    if (!series.tanggalMulai) { alert("Tanggal mulai wajib diisi."); return; }
    if (series.akhir.jenis === "tanggal" && !series.akhir.sampai) { alert("Tanggal akhir seri wajib diisi."); return; }
    const entry = { id: editPengajianId || uid(), tipe: "mingguan", ...series };
    daftarBaru =
      editPengajianId
        ? loadJadwalPengajian().map((x) => (x.id === editPengajianId ? entry : x))
        : [...loadJadwalPengajian(), entry];
  }
  await simpanDenganStatus("status-pengajian", e.currentTarget, () => saveJadwalPengajian(daftarBaru));
  renderDatalistPengisi();
  batalEditPengajian();
}

// ---------- Jum'at ----------
function renderJumat() {
  const settings = loadJumatSettings();
  $("jumat-menit").value = settings.durasiMenit;
  $("jumat-sholat-mode-aktif").checked = settings.sholatModeAktif;
  renderJumatSlides();
}

async function simpanJumatSettingsForm(e) {
  e.preventDefault();
  const menit = parseInt($("jumat-menit").value, 10);
  const settingsSebelumnya = loadJumatSettings();
  const durasiMenit = Number.isFinite(menit) && menit > 0 ? Math.min(menit, 240) : settingsSebelumnya.durasiMenit;
  await simpanDenganStatus("status-jumat", e.currentTarget, () => saveJumatSettings({ durasiMenit, sholatModeAktif: $("jumat-sholat-mode-aktif").checked }));
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
    const thumb = s.tipe === "gambar" ? `<img src="${s.urlCloud}" alt="" loading="lazy">` : "&#127916;";
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
      if (!confirm(`Hapus slide "${s.file}"?`)) return;
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
  const tipe = file.type.startsWith("video") ? "video" : "gambar";
  const id = uid();
  const ekstensiMatch = /\.([a-z0-9]+)$/i.exec(file.name);
  const ext = ekstensiMatch ? ekstensiMatch[1].toLowerCase() : (tipe === "video" ? "mp4" : "jpg");
  const nama = `jumat-${id}.${ext}`;

  if (!cloudAktif()) {
    alert("Cloud belum dikonfigurasi - lihat js/supabase-config.js.");
    return;
  }
  const hasil = await simpanMedia({
    file,
    nama,
    buatMetadata: (urlCloud) => [...loadJumatSlides(), { id, tipe, file: nama, durasiDetik: durasi, urlCloud }],
    simpanMetadata: saveJumatSlides,
  });
  if (!hasil.ok) {
    alert("Gagal menyimpan file dan metadata slide.");
    return;
  }
  $("jumat-file").value = "";
  tampilkanStatus("status-jumat-slide");
  renderJumatSlides();
}

async function hapusJumatSlide(s) {
  const hasil = await hapusMedia({
    media: s.urlCloud,
    buatMetadata: () => loadJumatSlides().filter((x) => x.id !== s.id),
    simpanMetadata: saveJumatSlides,
  });
  renderJumatSlides();
  tampilkanStatus("status-jumat-slide", hasil.pembersihanTertunda ? "Slide dihapus. File lama akan dibersihkan otomatis." : "Tersimpan.", !!hasil.pembersihanTertunda, !!hasil.pembersihanTertunda);
}

// ---------- Kegiatan Terdekat: daftar gambar (bisa lebih dari satu) ----------
let editAcaraId = null;

function renderAcaraSlides() {
  const arr = loadAcaraSlides();
  const ul = $("acara-list");
  ul.innerHTML = "";
  if (!arr.length) { ul.innerHTML = "<li>(belum ada gambar)</li>"; return; }
  arr.forEach((s) => {
    const li = document.createElement("li");
    li.classList.toggle("aktif-edit", s.id === editAcaraId);
    li.innerHTML = `
      <div class="admin-item-thumb"><img src="${s.urlCloud}" alt="" loading="lazy"></div>
      <div class="admin-item-info">
        <p class="admin-item-judul">Gambar</p>
        <p class="admin-item-meta">${s.durasiDetik} detik</p>
      </div>
      <div class="admin-item-aksi">
        <button type="button" class="btn-inline" data-aksi="edit">Edit</button>
        <button type="button" class="btn-inline btn-bahaya" data-aksi="hapus">Hapus</button>
      </div>
    `;
    li.querySelector('[data-aksi="edit"]').addEventListener("click", () => mulaiEditAcara(s));
    li.querySelector('[data-aksi="hapus"]').addEventListener("click", async () => {
      if (!confirm("Hapus gambar ini?")) return;
      if (editAcaraId === s.id) batalEditAcara();
      const hasil = await hapusMedia({
        media: s.urlCloud,
        buatMetadata: () => loadAcaraSlides().filter((x) => x.id !== s.id),
        simpanMetadata: saveAcaraSlides,
      });
      renderAcaraSlides();
      tampilkanStatus("status-acara-slide", hasil.pembersihanTertunda ? "Gambar dihapus. File lama akan dibersihkan otomatis." : "Tersimpan.", !!hasil.pembersihanTertunda, !!hasil.pembersihanTertunda);
    });
    ul.appendChild(li);
  });
}

function mulaiEditAcara(s) {
  editAcaraId = s.id;
  $("acara-durasi").value = s.durasiDetik;
  $("acara-file").value = "";
  $("tombol-tambah-acara").textContent = "Simpan Perubahan";
  $("tombol-batal-acara").hidden = false;
  renderAcaraSlides();
}

function batalEditAcara() {
  editAcaraId = null;
  $("acara-file").value = "";
  $("acara-durasi").value = 8;
  $("tombol-tambah-acara").textContent = "Tambah Gambar";
  $("tombol-batal-acara").hidden = true;
  renderAcaraSlides();
}

async function tambahAcaraSlide() {
  const durasi = parseInt($("acara-durasi").value, 10) || 8;
  const file = $("acara-file").files[0];
  if (editAcaraId) {
    const slides = loadAcaraSlides();
    const lama = slides.find((s) => s.id === editAcaraId);
    if (!lama) { batalEditAcara(); return; }
    let baru = { ...lama, durasiDetik: durasi };
    if (file) {
      if (!cloudAktif()) { alert("Cloud belum dikonfigurasi - lihat js/supabase-config.js."); return; }
      const ekstensiMatch = /\.([a-z0-9]+)$/i.exec(file.name);
      const ext = ekstensiMatch ? ekstensiMatch[1].toLowerCase() : "jpg";
      const nama = `acara-${lama.id}.${ext}`;
      const hasil = await simpanMedia({
        file,
        nama,
        mediaLama: lama.urlCloud,
        buatMetadata: (urlCloud) => slides.map((s) => (s.id === editAcaraId ? { ...baru, file: nama, urlCloud } : s)),
        simpanMetadata: saveAcaraSlides,
      });
      if (!hasil.ok) { alert("Gagal menyimpan gambar dan metadata baru."); return; }
      tampilkanStatus("status-acara-slide", hasil.pembersihanTertunda ? "Gambar diperbarui. File lama akan dibersihkan otomatis." : "Tersimpan.", !!hasil.pembersihanTertunda, !!hasil.pembersihanTertunda);
      batalEditAcara();
      return;
    }
    saveAcaraSlides(slides.map((s) => (s.id === editAcaraId ? baru : s)));
    tampilkanStatus("status-acara-slide");
    batalEditAcara();
    return;
  }
  if (!file) { alert("Pilih gambar dulu."); return; }
  if (!cloudAktif()) {
    alert("Cloud belum dikonfigurasi - lihat js/supabase-config.js.");
    return;
  }
  const id = uid();
  const ekstensiMatch = /\.([a-z0-9]+)$/i.exec(file.name);
  const ext = ekstensiMatch ? ekstensiMatch[1].toLowerCase() : "jpg";
  const nama = `acara-${id}.${ext}`;
  const hasil = await simpanMedia({
    file,
    nama,
    buatMetadata: (urlCloud) => [...loadAcaraSlides(), { id, file: nama, durasiDetik: durasi, urlCloud }],
    simpanMetadata: saveAcaraSlides,
  });
  if (!hasil.ok) { alert("Gagal menyimpan gambar dan metadata."); return; }
  $("acara-file").value = "";
  tampilkanStatus("status-acara-slide");
  renderAcaraSlides();
}

initFilePicker("murotal");
initFilePicker("nada");

// Dikumpulkan jadi satu fungsi supaya bisa dipanggil ulang setelah tarik
// data terbaru dari cloud (lihat tarikUlangDariCloud() di bawah) - admin.html
// beda dari kiosk, TIDAK auto-sync terus-menerus, jadi begitu dibuka perlu
// tarik sekali biar tidak nampilin data basi kalau ada perubahan dari device lain.
function renderSemuaData() {
  renderKoreksiWaktu();
  renderIqomah();
  renderHening();
  renderTarawih();
  renderAcara();
  renderAcaraSlides();
  renderTampilan();
  renderPengumuman();
  renderRotasi();
  renderTema();
  renderAdzan();
  renderJumat();
  renderNada();
  LAYAR_BG.forEach(renderBgLayar);
}
renderSemuaData();
muatJadwalKoreksiHariIni();

async function tarikUlangDariCloud() {
  if (!cloudAktif()) return;
  await cobaUlangPembersihanMedia();
  const rows = await cloudGetAll();
  tulisKeLocal(rows);
  renderSemuaData();
}
tarikUlangDariCloud();

$("form-iqomah").addEventListener("submit", simpanIqomah);
$("form-koreksi-waktu").addEventListener("submit", simpanKoreksiWaktu);
$("form-koreksi-waktu").addEventListener("input", renderRingkasanKoreksi);
$("tombol-reset-koreksi-waktu").addEventListener("click", resetKoreksiWaktuForm);
$("form-hening").addEventListener("submit", simpanHening);
$("form-tarawih").addEventListener("submit", simpanTarawih);
$("form-tarawih-tanggal").addEventListener("submit", simpanTarawihTanggal);
$("tarawih-nonaktif").addEventListener("change", renderTarawihStatus);
$("tarawih-tanggal-mulai").addEventListener("input", renderTarawihStatus);
$("tarawih-tanggal-selesai").addEventListener("input", renderTarawihStatus);
$("form-acara-mode").addEventListener("submit", simpanAcaraMode);
document.querySelectorAll('input[name="acara-mode"]').forEach((r) => {
  r.addEventListener("change", () => syncAcaraModeToggle(r.value));
});
$("form-acara-sebelum").addEventListener("submit", simpanAcaraSebelum);
$("form-acara-sesudah").addEventListener("submit", simpanAcaraSesudah);
$("form-tampilan").addEventListener("submit", simpanTampilan);
$("form-tambah-pengumuman").addEventListener("submit", tambahPengumuman);
$("tampilan-maklumat").addEventListener("change", () => {
  const dipilih = document.querySelector('input[name="tema-tampilan"]:checked');
  syncTampilanToggle(dipilih?.value || "");
});
$("form-rotasi").addEventListener("submit", simpanRotasi);
document.querySelector(`[data-tema-kartu="tampilan"]`).addEventListener("change", (e) => {
  if (e.target.name === "tema-tampilan") syncTampilanToggle(e.target.value);
});
$("form-tema-tampilan").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dipilih = document.querySelector(`input[name="tema-tampilan"]:checked`);
  if (!dipilih) return;
  tampilkanStatus("status-tema-tampilan", "Menyimpan…", false, true);
  await simpanDenganStatus("status-tema-tampilan", e.currentTarget, () => simpanTemaTampilan(dipilih.value));
});
// Stepper +/- generik. Delegasi click menjaga tombol tetap berfungsi setelah
// renderSemuaData() mengganti baris dinamis saat sinkronisasi cloud selesai.
document.addEventListener("click", (e) => {
  const btn = e.target.closest?.(".stepper-btn");
  if (!btn) return;
  const input = $(btn.dataset.target);
  if (!input) return;
  const step = parseInt(input.step, 10) || 1;
  input.value = (parseInt(input.value, 10) || 0) + step * Number(btn.dataset.arah);
  clampBarisInput(input);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
document.querySelectorAll('.stepper input[type="number"]').forEach((input) => {
  input.addEventListener("change", () => clampBarisInput(input));
});
document.addEventListener("change", (e) => {
  if (e.target.matches?.('.stepper input[type="number"]')) clampBarisInput(e.target);
});
Object.values(ROTASI_FIELDS).forEach((f) => {
  $(f.input).addEventListener("input", recalcRotasiTimeline);
});
$("form-adzan").addEventListener("submit", simpanAdzanForm);
$("form-jumat").addEventListener("submit", simpanJumatSettingsForm);
$("tombol-tambah-jumat").addEventListener("click", tambahJumatSlide);
$("tombol-tambah-acara").addEventListener("click", tambahAcaraSlide);
$("tombol-batal-jumat").addEventListener("click", batalEditJumat);
$("tombol-batal-acara").addEventListener("click", batalEditAcara);
LAYAR_BG.forEach((layar) => {
  $(`tombol-simpan-bg-${layar}`).addEventListener("click", () => simpanBgLayarForm(layar));
  $(`tombol-hapus-bg-${layar}`).addEventListener("click", () => hapusBgLayarForm(layar));
  $(`form-bg-${layar}`).addEventListener("submit", (e) => {
    e.preventDefault();
    simpanBgLayarForm(layar, { requireFile: false });
  });
});

["murotal-mulai", "murotal-berhenti"].forEach((id) => {
  $(id).addEventListener("input", () => {
    enforceMurotalOrder(id);
    renderMurotalPreview();
  });
});

renderMurotal();
renderQr();
renderPengajian();
renderDatalistPengisi();
muatDaftarSurah();
toggleTipePengajian();

$("form-murotal").addEventListener("submit", simpanMurotal);
$("tombol-tambah-file").addEventListener("click", tambahFileMurotal);
$("tombol-tambah-api").addEventListener("click", tambahApiMurotal);
$("form-nada-iqomah").addEventListener("submit", (e) => simpanNadaForm(e, {
  mediaKey: "nadaIqomah", fileId: "nada-file", durasiId: "nada-iqomah-detik", settingKey: "iqomahDetik", statusId: "status-nada",
}));
$("form-nada-sholat-mode").addEventListener("submit", (e) => simpanNadaForm(e, {
  mediaKey: "nadaSholatMode", fileId: "nada-sholat-mode-file", durasiId: "nada-sholat-mode-detik", settingKey: "sholatModeDetik", statusId: "status-nada-sholat-mode",
}));
$("tombol-hapus-nada").addEventListener("click", () => hapusNada("nadaIqomah", "status-nada", "Iqomah"));
$("tombol-tes-nada").addEventListener("click", () => tesNada("nada-preview", "nadaIqomah", "iqomahDetik"));
$("tombol-hapus-nada-sholat-mode").addEventListener("click", () => hapusNada("nadaSholatMode", "status-nada-sholat-mode", "Sholat Mode"));
$("tombol-tes-nada-sholat-mode").addEventListener("click", () => tesNada("nada-sholat-mode-preview", "nadaSholatMode", "sholatModeDetik"));
$("form-qr").addEventListener("submit", simpanQr);
$("tombol-hapus-qr").addEventListener("click", hapusQr);
$("pengajian-tipe").addEventListener("change", toggleTipePengajian);
$("tombol-tambah-baris").addEventListener("click", () => tambahBarisJadwal({}));
$("form-pengajian").addEventListener("submit", tambahPengajian);
$("tombol-batal-pengajian").addEventListener("click", batalEditPengajian);

["mg-tanggal-mulai", "mg-jam", "mg-akhir-tanggal", "mg-akhir-jumlah", "mg-rotasi-daftar"].forEach((id) => {
  $(id).addEventListener("input", mgRenderTabel);
});
$("mg-akhir-jenis").addEventListener("change", () => {
  const jenis = $("mg-akhir-jenis").value;
  $("mg-akhir-tanggal-wrap").hidden = jenis !== "tanggal";
  $("mg-akhir-jumlah-wrap").hidden = jenis !== "jumlah";
  mgRenderTabel();
});
$("mg-rotasi-aktif").addEventListener("change", () => {
  $("mg-rotasi-wrap").hidden = !$("mg-rotasi-aktif").checked;
  mgRenderTabel();
});

// ---------- Navigasi sidebar ----------
const ADMIN_PANEL_INFO = {
  "jadwal-sholat": {
    eyebrow: "Kontrol layar",
    title: "Jadwal Sholat",
    desc: "Atur tema layar, header, dan maklumat berjalan.",
  },
  rotasi: {
    eyebrow: "Kontrol layar",
    title: "Rotasi Layar",
    desc: "Tentukan durasi dan urutan perpindahan layar.",
  },
  adzan: {
    eyebrow: "Kontrol layar",
    title: "Mode Adzan",
    desc: "Pilih tampilan adzan, unggah latar, dan atur suara adzan yang diputar otomatis.",
  },
  iqomah: {
    eyebrow: "Kontrol layar",
    title: "Iqomah",
    desc: "Atur hitung mundur iqomah per waktu sholat serta nada pengingatnya.",
  },
  "sholat-mode": {
    eyebrow: "Kontrol layar",
    title: "Mode Sholat",
    desc: "Atur durasi layar hening setelah iqomah dan audio penanda masuk mode sholat.",
  },
  donasi: {
    eyebrow: "Kontrol layar",
    title: "QR Donasi",
    desc: "Judul, ajakan donasi, dan gambar QRIS.",
  },
  kegiatan: {
    eyebrow: "Isi layar",
    title: "Jadwal Kegiatan",
    desc: "Tambah kegiatan mingguan atau tanggal khusus yang tampil otomatis di layar.",
  },
  acara: {
    eyebrow: "Isi layar",
    title: "Kegiatan Terdekat",
    desc: "Unggah poster acara dan tentukan kapan poster muncul di rotasi layar.",
  },
  jumat: {
    eyebrow: "Isi layar",
    title: "Mode Jumat",
    desc: "Siapkan poster, jadwal, dan aturan tampilan khusus untuk hari Jumat.",
  },
  tarawih: {
    eyebrow: "Isi layar",
    title: "Mode Tarawih",
    desc: "Kelola jadwal imam, bilal, dan pengaturan layar Ramadhan.",
  },
  audio: {
    eyebrow: "Isi layar",
    title: "Murotal",
    desc: "Atur playlist audio murotal, jadwal putar, dan volume untuk speaker layar.",
  },
};

const ADMIN_PREVIEW_SRC = {
  "jadwal-sholat": "index.html",
  rotasi: "index.html",
  adzan: "index.html?preview=1&view=iqomah&fase=adzan",
  iqomah: "index.html?preview=1&view=iqomah&fase=iqomah",
  "sholat-mode": "index.html?preview=1&view=hening",
  donasi: "index.html?preview=1&view=qr",
  kegiatan: "index.html?preview=1&view=kegiatan",
  acara: "index.html?preview=1&view=acara",
  jumat: "index.html?preview=1&view=jumat",
  tarawih: "index.html?preview=1&view=hening",
  audio: "index.html",
};

const panelAdmin = (nama) => document.querySelector(`.admin-main [data-panel="${nama}"]`);
const panelAdminAktif = () => document.querySelector(".admin-main [data-panel]:not([hidden])");

function formTersimpanDalam(section) {
  const media = new Set([
    "form-qr", "form-bg-adzan", "form-bg-iqomah", "form-bg-donasi",
    "form-tambah-pengumuman",
  ]);
  return [...section.querySelectorAll("form")].filter((f) => !f.classList.contains("form-tambah-item") && !media.has(f.id));
}

async function simpanSection(section) {
  if (!section) return;
  const forms = formTersimpanDalam(section);
  for (const f of forms) {
    if (f.hasAttribute("data-skip-native-validation")) continue;
    if (!f.checkValidity()) { f.reportValidity(); return; }
  }
  const tombol = $("tombol-simpan-global");
  tombol.disabled = true;
  tampilkanStatus("status-simpan-global", "Menyimpan…", false, true);
  forms.forEach((f) => f.requestSubmit());
  try {
    const hasil = await tungguSemuaPengaturan();
    const adaTertunda = hasil.some((item) => item && item.tertunda);
    const lokalGagal = hasil.some((item) => item && item.lokal === false);
    if (lokalGagal) tampilkanHasilSimpan("status-simpan-global", { lokal: false });
    else if (adaTertunda) tampilkanHasilSimpan("status-simpan-global", { lokal: true, tertunda: true });
    else tampilkanStatus("status-simpan-global", "Semua perubahan tersimpan.");
  } finally {
    tombol.disabled = false;
  }
}

function updateAdminTopbar(nama) {
  const info = ADMIN_PANEL_INFO[nama];
  if (!info) return;

  const eyebrow = $("admin-page-eyebrow");
  const title = $("admin-page-title");
  const desc = $("admin-page-desc");
  if (eyebrow) eyebrow.textContent = info.eyebrow;
  if (title) title.textContent = info.title;
  if (desc) desc.textContent = info.desc;
  const tombolPreviewGlobal = $("tombol-preview-global");
  if (tombolPreviewGlobal) tombolPreviewGlobal.dataset.previewSrc = ADMIN_PREVIEW_SRC[nama] || "index.html";

}

function setupNavigasi() {
  // [data-section] sengaja disyaratkan - ".admin-nav-item" juga dipakai buat
  // tombol lain yang bukan navigasi panel (mis. tombol Keluar/logout admin).
  const items = document.querySelectorAll(".admin-nav-item[data-section]");
  const namaPanelValid = (nama) => Boolean(nama && panelAdmin(nama));
  const tampilkanPanel = (nama, updateHash = true) => {
    if (!namaPanelValid(nama)) return;
    const itemAktif = [...items].find((b) => b.dataset.section === nama);
    items.forEach((b) => {
      const aktif = b === itemAktif;
      b.classList.toggle("aktif", aktif);
      b.toggleAttribute("aria-current", aktif);
      if (aktif) b.setAttribute("aria-current", "page");
    });
    document.querySelectorAll(".admin-main [data-panel]").forEach((p) => {
      p.hidden = p.dataset.panel !== nama;
    });
    updateAdminTopbar(nama);
    if (itemAktif && window.matchMedia("(max-width: 860px)").matches) {
      const nav = itemAktif.closest(".admin-nav");
      nav?.scrollTo({
        left: Math.max(0, itemAktif.offsetLeft - (nav.clientWidth - itemAktif.offsetWidth) / 2),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
    if (updateHash && location.hash !== `#${nama}`) {
      history.replaceState(null, "", `#${nama}`);
    }
  };

  items.forEach((btn) => {
    btn.addEventListener("click", () => {
      tampilkanPanel(btn.dataset.section);
    });
  });

  window.addEventListener("hashchange", () => {
    const nama = location.hash.slice(1);
    if (namaPanelValid(nama)) tampilkanPanel(nama, false);
  });

  const hashAwal = location.hash.slice(1);
  const aktifAwal = namaPanelValid(hashAwal)
    ? hashAwal
    : (document.querySelector(".admin-nav-item[data-section].aktif") ?? items[0])?.dataset.section;
  tampilkanPanel(aktifAwal, false);
}
setupNavigasi();

function setupLabelUpload() {
  [
    { inputId: "qr-file", labelId: "qr-file-label", kosong: "PNG/JPG, disarankan bujur sangkar" },
    { inputId: "donasi-bg-file", labelId: "donasi-bg-file-label", kosong: "PNG/JPG maks 5MB" },
  ].forEach(({ inputId, labelId, kosong }) => {
    const input = $(inputId);
    const label = $(labelId);
    if (!input || !label) return;
    input.addEventListener("change", () => {
      label.textContent = input.files[0]?.name || kosong;
    });
  });
}
setupLabelUpload();

// ---------- Login Admin (Supabase Auth) ----------
// Kalau cloud belum dikonfigurasi (supabase-config.js kosong), gerbang ini
// dilewati seluruhnya - admin.html jalan tanpa login sama sekali, persis
// seperti sebelum fitur cloud ada.
async function terapkanGateLogin() {
  if (!cloudAktif()) return;

  const sudahLogin = await sesiAktif();
  if (sudahLogin) return;

  $("admin-login-gate").hidden = false;
  $("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-error").hidden = true;
    const hasil = await login($("login-email").value, $("login-password").value);
    if (hasil.ok) {
      location.reload();
    } else {
      $("login-error").textContent = hasil.pesan;
      $("login-error").hidden = false;
    }
  });
}
terapkanGateLogin();

async function terapkanTombolKeluar() {
  if (!cloudAktif()) return;
  if (!(await sesiAktif())) return;
  const tombol = $("tombol-keluar-admin");
  tombol.hidden = false;
  tombol.addEventListener("click", async () => {
    await logout();
    location.reload();
  });
}
terapkanTombolKeluar();

// ---------- Aksi akhir tiap section sidebar: Kembali / Preview ----------
// Tombol simpan global mengirim semua form pada panel aktif. Form "Tambah"
// item list dikecualikan lewat class .form-tambah-item karena sudah menyimpan
// sendiri per klik. Preview membuka layar aslinya di tab baru, coba layar penuh
// otomatis (fullscreen=1, lihat js/fullscreen.js). ?preview=1 pada beberapa
// target memaksa halaman itu tampil dengan data contoh & tidak auto-pulang/
// redirect (lihat js/*.js masing-masing). "Kembali ke Halaman" cukup link
// biasa ke index.html, tidak butuh JS.
function setupSimpanSection() {
  const tombolSimpanGlobal = $("tombol-simpan-global");
  if (tombolSimpanGlobal) {
    tombolSimpanGlobal.addEventListener("click", () => simpanSection(panelAdminAktif()));
  }
}
setupSimpanSection();

function setupPreviewSection() {
  const btn = $("tombol-preview-global");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const src = btn.dataset.previewSrc || "index.html";
    const pemisah = src.includes("?") ? "&" : "?";
    window.open(`${src}${pemisah}fullscreen=1&_=${Date.now()}`, "_blank");
  });
}
setupPreviewSection();
