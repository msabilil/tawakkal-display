// Daftar & gerbang slide "Demo Layar" - dipisah dari demo.js (yang sentuh DOM
// di scope modul) supaya bisa diuji langsung tanpa elemen HTML demo.html.
import { kartuTersedia, loadRotasi } from "./rotasi.js";
import { loadJumatSlides } from "./jumat-mode.js";
import { loadJumatSettings } from "./jumat-mode.js";
import { loadAcaraSlides } from "./acara-mode.js";
import { loadAdzan, loadHening, loadIqomah } from "./settings.js";
import { SHOLAT } from "./config.js";
import { readCache } from "./api.js";
import { parseHM } from "./waktu.js";

function sholatBerikutnya() {
  const cache = readCache();
  const now = new Date();
  if (!cache || !cache.jadwal) return "dzuhur";
  return (SHOLAT.find(({ key }) => parseHM(cache.jadwal[key], now) > now) || SHOLAT[0]).key;
}

function durasiIqomah() {
  const s = loadIqomah()[sholatBerikutnya()] || {};
  return s.aktif && s.menit > 0 ? s.menit * 60000 : 1000;
}

function durasiHening() {
  const s = loadHening()[sholatBerikutnya()] || {};
  return s.aktif && s.menit > 0 ? s.menit * 60000 : 1000;
}

function durasiAcara() {
  return loadAcaraSlides().reduce((total, s) => total + Math.max(1, s.durasiDetik) * 1000, 1000);
}

function durasiJumat() {
  const s = loadJumatSettings();
  const hening = s.sholatModeAktif ? Math.max(0, loadHening().dzuhur.menit || 0) : 0;
  return (s.durasiMenit + hening) * 60000;
}

export const SEMUA_SLIDE = [
  { label: "Jadwal Sholat", src: "index.html?demo=1", durasi: () => loadRotasi().sholatDetik * 1000 },
  { label: "Adzan", src: "index.html?preview=1&view=iqomah&fase=adzan", durasi: () => loadAdzan().menit * 60000 },
  { label: "Iqomah", src: "index.html?preview=1&view=iqomah&fase=iqomah", durasi: durasiIqomah },
  { label: "Hening", src: "index.html?preview=1&view=hening", durasi: durasiHening },
  { label: "QR Donasi", src: "index.html?preview=1&view=qr", kartu: "qr", durasi: () => loadRotasi().qrDonasiDetik * 1000 },
  { label: "Kegiatan Terdekat", src: "index.html?preview=1&view=acara", kartu: "acara", durasi: durasiAcara },
  { label: "Jadwal Kegiatan", src: "index.html?preview=1&view=kegiatan", kartu: "kegiatan", durasi: () => loadRotasi().jadwalPengajianDetik * 1000 },
  { label: "Jum'at", src: "index.html?preview=1&view=jumat", perlu: () => loadJumatSlides().length > 0, durasi: durasiJumat },
];

// Slide "kartu" (qr/kegiatan) cuma masuk kalau kartuTersedia() -
// gerbang yang sama dipakai rotasi asli - bilang fitur itu memang aktif.
// Slide ber-"perlu" (jum'at) masuk kalau memang ada kontennya.
export function slideAktif(now = new Date()) {
  const kartu = kartuTersedia(now);
  return SEMUA_SLIDE.filter((s) => {
    if (s.kartu) return kartu.includes(s.kartu);
    if (s.perlu) return s.perlu();
    return true;
  });
}
