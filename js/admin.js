import { SHOLAT, WAKTU_HARIAN, QORI } from "./config.js";
import { loadIqomah, saveIqomah } from "./settings.js";
import { loadOverride, saveOverride, clearOverride } from "./testing.js";
import { loadTampilan, saveTampilan } from "./tampilan.js";
import { loadMurotal, saveMurotal } from "./murotal.js";
import { loadRotasi, saveRotasi, loadQr, saveQr, clearQr } from "./rotasi.js";
import { loadJadwalPengajian, saveJadwalPengajian } from "./jadwal-pengajian.js";
import { putMedia, delMedia } from "./media-db.js";
import { mainkanNada } from "./nada.js";

const $ = (id) => document.getElementById(id);

function renderIqomah() {
  const settings = loadIqomah();
  const wrap = $("baris-sholat");
  wrap.innerHTML = "";
  $("admin-hint").hidden = true;
  for (const { key, label } of SHOLAT) {
    const s = settings[key];
    const row = document.createElement("div");
    row.className = "baris";
    row.innerHTML = `
      <span class="label-sholat">${label}</span>
      <input type="number" min="0" max="60" id="menit-${key}" value="${s.menit}">
      <label class="aktif-cek"><input type="checkbox" id="aktif-${key}" ${s.aktif ? "checked" : ""}> aktif</label>
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

function renderTesting() {
  const ov = loadOverride();
  $("testing-aktif").checked = ov.aktif;
  const wrap = $("baris-testing");
  wrap.innerHTML = "";
  for (const { key, label } of WAKTU_HARIAN) {
    const row = document.createElement("div");
    row.className = "baris baris-testing";
    row.innerHTML = `
      <span class="label-sholat">${label}</span>
      <input type="time" id="ov-${key}" value="${ov.jadwal[key] || ""}">
    `;
    wrap.appendChild(row);
  }
}

function simpanTesting(e) {
  e.preventDefault();
  const jadwal = {};
  for (const { key } of WAKTU_HARIAN) {
    jadwal[key] = $(`ov-${key}`).value || "";
  }
  saveOverride({ aktif: $("testing-aktif").checked, jadwal });
  tampilkanStatus("status-testing");
}

function resetTesting() {
  clearOverride();
  renderTesting();
  tampilkanStatus("status-testing");
}

function tampilkanStatus(id) {
  const el = $(id);
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2000);
}

// ---------- Murotal ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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
    row.innerHTML = `<input type="checkbox" id="murotal-sholat-${key}" ${s.perSholat[key] ? "checked" : ""}> ${label}`;
    wrap.appendChild(row);
  }
  renderPlaylist();
}

function renderPlaylist() {
  const s = loadMurotal();
  const ul = $("murotal-playlist");
  ul.innerHTML = "";
  if (!s.playlist.length) { ul.innerHTML = "<li>(kosong)</li>"; return; }
  s.playlist.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${item.label}</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tombol-sekunder";
    btn.textContent = "Hapus";
    btn.addEventListener("click", async () => {
      const cur = loadMurotal();
      cur.playlist = cur.playlist.filter((p) => p.id !== item.id);
      if (item.tipe === "offline") await delMedia(item.mediaKey);
      if (cur.posisi.index >= cur.playlist.length) cur.posisi = { index: 0, detik: 0 };
      saveMurotal(cur);
      renderPlaylist();
    });
    li.appendChild(btn);
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
  tampilkanStatus("status-nada");
}
async function hapusNada() {
  await delMedia("nadaIqomah");
  tampilkanStatus("status-nada");
}
function tesNada() {
  mainkanNada($("nada-preview"));
}

// ---------- QR Donasi ----------
function renderQr() {
  const q = loadQr();
  const r = loadRotasi();
  if (q) {
    $("qr-judul").value = q.judul || "";
    $("qr-teks").value = q.teks || "";
    $("qr-preview").src = q.dataUrl;
    $("qr-preview").hidden = false;
  }
  // durasi rotasi dipakai bersama; sisipkan input durasi sederhana di section QR
  $("qr-judul").dataset.durasiQr = r.qrDonasiDetik;
  $("qr-judul").dataset.durasiJadwal = r.jadwalPengajianDetik;
}

function simpanQr(e) {
  e.preventDefault();
  const file = $("qr-file").files[0];
  const judul = $("qr-judul").value.trim();
  const teks = $("qr-teks").value.trim();
  const simpanObj = (dataUrl) => {
    saveQr({ dataUrl, judul, teks });
    $("qr-preview").src = dataUrl;
    $("qr-preview").hidden = false;
    tampilkanStatus("status-qr");
  };
  if (file) {
    const reader = new FileReader();
    reader.onload = () => simpanObj(reader.result);
    reader.readAsDataURL(file);
  } else {
    const q = loadQr();
    if (!q) { alert("Pilih gambar QR dulu."); return; }
    simpanObj(q.dataUrl); // update judul/teks saja
  }
}
function hapusQr() {
  clearQr();
  $("qr-preview").hidden = true;
  $("qr-judul").value = "";
  $("qr-teks").value = "";
  tampilkanStatus("status-qr");
}

// ---------- Jadwal Pengajian ----------
const HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function toggleTipePengajian() {
  const tipe = $("pengajian-tipe").value;
  $("baris-hari").hidden = tipe !== "mingguan";
  $("baris-tanggal").hidden = tipe !== "tanggal";
}

function renderPengajian() {
  const arr = loadJadwalPengajian();
  const ul = $("pengajian-list");
  ul.innerHTML = "";
  if (!arr.length) { ul.innerHTML = "<li>(belum ada jadwal)</li>"; return; }
  arr.forEach((e) => {
    const kapan = e.tipe === "mingguan" ? `${HARI_NAMA[e.hari]} ${e.jam}` : `${e.tanggal} ${e.jam}`;
    const li = document.createElement("li");
    li.innerHTML = `<span>${e.nama} — ${kapan}${e.pengisi ? " — " + e.pengisi : ""}</span>`;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "tombol-sekunder"; btn.textContent = "Hapus";
    btn.addEventListener("click", () => {
      saveJadwalPengajian(loadJadwalPengajian().filter((x) => x.id !== e.id));
      renderPengajian();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function tambahPengajian(e) {
  e.preventDefault();
  const tipe = $("pengajian-tipe").value;
  const jam = $("pengajian-jam").value;
  const nama = $("pengajian-nama").value.trim();
  const pengisi = $("pengajian-pengisi").value.trim();
  if (!jam || !nama) { alert("Jam dan nama kegiatan wajib diisi."); return; }
  const entry = { id: uid(), tipe, jam, nama, pengisi };
  if (tipe === "mingguan") {
    entry.hari = parseInt($("pengajian-hari").value, 10);
  } else {
    const tanggal = $("pengajian-tanggal").value;
    if (!tanggal) { alert("Tanggal wajib diisi."); return; }
    entry.tanggal = tanggal;
  }
  saveJadwalPengajian([...loadJadwalPengajian(), entry]);
  $("pengajian-nama").value = "";
  $("pengajian-pengisi").value = "";
  tampilkanStatus("status-pengajian");
  renderPengajian();
}

renderIqomah();
renderTampilan();
renderTesting();
$("form-iqomah").addEventListener("submit", simpanIqomah);
$("form-tampilan").addEventListener("submit", simpanTampilan);
$("form-testing").addEventListener("submit", simpanTesting);
$("tombol-reset-testing").addEventListener("click", resetTesting);

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
