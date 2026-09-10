import { DEFAULT_ROTASI } from "./config.js";
import { loadJadwalPengajian, entriAktif } from "./jadwal-pengajian.js";
import { loadAcara, acaraAktif, loadAcaraSlides } from "./acara-mode.js";
import { readCache } from "./api.js";
import { tampilkan } from "./navigasi.js";
import { cloudSet } from "./cloud.js";

const KEY_ROTASI = "rotasiSettings";
const KEY_QR = "qrDonasi";
const KEY_URUTAN = "halamanUrutan"; // localStorage: posisi kartu sekunder aktif dalam putaran sekarang
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
  cloudSet(KEY_ROTASI, s);
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
  cloudSet(KEY_QR, obj);
}

export function clearQr() {
  localStorage.removeItem(KEY_QR);
}

// Kartu/layar sekunder yang lagi punya isi buat ditampilkan bergilir.
export function kartuTersedia(now) {
  const kartu = [];
  if (loadQr()) kartu.push("qr");
  const cache = readCache();
  if (cache && cache.jadwal && loadAcaraSlides().length && acaraAktif(now, cache.jadwal, loadAcara())) kartu.push("acara");
  if (entriAktif(now, loadJadwalPengajian()).length) kartu.push("kegiatan");
  return kartu;
}

// Dipanggil sekali di start() app.js - tandai "baru masuk view sholat", jadi
// durasi tampil dihitung dari sini, bukan dari kunjungan sebelumnya.
export function mulaiSesiSholat() {
  sessionStorage.setItem(KEY_SEJAK, String(Date.now()));
}

// Dipanggil tiap detik dari tick() app.js, HANYA selama tidak lagi iqomah.
// Setelah durasi tampil jadwal sholat lewat, mulai 1 putaran kartu sekunder
// (qr lalu kegiatan, urut sesuai kartuTersedia()). View qr & kegiatan yang
// bertugas lanjut ke kartu berikutnya sendiri lewat lanjutRotasi() di
// timeout masing-masing - baru balik ke "sholat" setelah putaran habis.
export function tickHalamanSholat(now) {
  const kartu = kartuTersedia(now);
  if (!kartu.length) return; // tidak ada apa-apa buat digilir, tetap di jadwal sholat

  const sejak = Number(sessionStorage.getItem(KEY_SEJAK)) || Date.now();
  const durasiMs = loadRotasi().sholatDetik * 1000;
  if (Date.now() - sejak < durasiMs) return;

  localStorage.setItem(KEY_URUTAN, "0");
  tampilkan(kartu[0]); // "qr" atau "kegiatan" - namanya sudah cocok sama nama view
}

// Dipanggil dari timeout view qr/kegiatan pas durasi tampilnya sendiri habis.
// Lanjut ke kartu berikutnya dalam putaran yang sama, atau balik ke "sholat"
// kalau sudah kartu terakhir.
export function lanjutRotasi(now) {
  const kartu = kartuTersedia(now);
  const pos = (Number(localStorage.getItem(KEY_URUTAN)) || 0) + 1;
  if (pos < kartu.length) {
    localStorage.setItem(KEY_URUTAN, String(pos));
    tampilkan(kartu[pos]);
  } else {
    localStorage.removeItem(KEY_URUTAN);
    tampilkan("sholat");
  }
}
