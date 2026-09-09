import { DEFAULT_ROTASI } from "./config.js";
import { loadJadwalPengajian, entriAktif } from "./jadwal-pengajian.js";
import { tampilkan } from "./navigasi.js";

const KEY_ROTASI = "rotasiSettings";
const KEY_QR = "qrDonasi";
const KEY_URUTAN = "halamanUrutan"; // localStorage: idx round-robin layar sekunder berikutnya
const KEY_SEJAK = "halamanSholatSejak"; // sessionStorage: timestamp masuk index.html

export function loadRotasi() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_ROTASI));
    return s ? { ...DEFAULT_ROTASI, ...s } : { ...DEFAULT_ROTASI };
  } catch {
    return { ...DEFAULT_ROTASI };
  }
}

export function saveRotasi(s) {
  localStorage.setItem(KEY_ROTASI, JSON.stringify(s));
}

export function loadQr() {
  try {
    const q = JSON.parse(localStorage.getItem(KEY_QR));
    return q && q.dataUrl ? q : null;
  } catch {
    return null;
  }
}

export function saveQr(obj) {
  localStorage.setItem(KEY_QR, JSON.stringify(obj));
}

export function clearQr() {
  localStorage.removeItem(KEY_QR);
}

// Kartu/layar sekunder yang lagi punya isi buat ditampilkan bergilir.
export function kartuTersedia(now) {
  const kartu = [];
  if (entriAktif(now, loadJadwalPengajian()).length) kartu.push("kegiatan");
  if (loadQr()) kartu.push("qr");
  return kartu;
}

// Dipanggil sekali di start() app.js - tandai "baru masuk view sholat", jadi
// durasi tampil dihitung dari sini, bukan dari kunjungan sebelumnya.
export function mulaiSesiSholat() {
  sessionStorage.setItem(KEY_SEJAK, String(Date.now()));
}

// Dipanggil tiap detik dari tick() app.js, HANYA selama tidak lagi iqomah.
// Setelah durasi tampil jadwal sholat lewat, gantian ke layar sekunder berikutnya
// (round-robin qr/kegiatan). View qr & kegiatan yang bertugas balik lagi ke
// view "sholat" sendiri lewat timeout masing-masing.
export function tickHalamanSholat(now) {
  const kartu = kartuTersedia(now);
  if (!kartu.length) return; // tidak ada apa-apa buat digilir, tetap di jadwal sholat

  const sejak = Number(sessionStorage.getItem(KEY_SEJAK)) || Date.now();
  const durasiMs = loadRotasi().sholatDetik * 1000;
  if (Date.now() - sejak < durasiMs) return;

  const idx = Number(localStorage.getItem(KEY_URUTAN)) || 0;
  const tujuan = kartu[idx % kartu.length];
  localStorage.setItem(KEY_URUTAN, String(idx + 1));
  tampilkan(tujuan); // "qr" atau "kegiatan" - namanya sudah cocok sama nama view
}
