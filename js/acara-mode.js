// Data & state "Kegiatan Terdekat" (poster foto latar yang tampil otomatis
// di rentang menit sebelum/sesudah waktu sholat). Dipisah dari acara.js
// (view) supaya tidak circular import - lihat pola sama di jumat-mode.js.
import { SHOLAT, DEFAULT_ACARA } from "./config.js";
import { parseHM } from "./waktu.js";
import { cloudSet } from "./cloud.js";
import { loadIqomah, loadHening, loadAdzan } from "./settings.js";

const KEY_SETTINGS = "acaraSettings";
const KEY_SLIDES = "acaraSlides"; // [{id, durasiDetik, urlCloud}] - diupload ke Supabase Storage, lihat admin.js

export function loadAcaraSlides() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY_SLIDES));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveAcaraSlides(slides) {
  localStorage.setItem(KEY_SLIDES, JSON.stringify(slides));
  cloudSet(KEY_SLIDES, slides);
}

export function loadAcara() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_SETTINGS)) || {};
    return {
      mode: s.mode === "selalu" ? "selalu" : DEFAULT_ACARA.mode,
      sebelum: { ...DEFAULT_ACARA.sebelum, ...(s.sebelum || {}) },
      sesudah: { ...DEFAULT_ACARA.sesudah, ...(s.sesudah || {}) },
    };
  } catch {
    return { ...DEFAULT_ACARA };
  }
}

export function saveAcara(settings) {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  cloudSet(KEY_SETTINGS, settings);
}

// Titik balik ke rotasi normal buat sholat "key" - selesai iqomah, DITAMBAH
// selesai hening kalau hening aktif untuk sholat ini (sama persis formula
// heningState() di app.js, sengaja diduplikasi kecil di sini daripada impor
// dari app.js supaya tidak circular import lewat rotasi.js).
function kembaliNormalWaktu(azanTime, key, adzanMenit, iqomahSettings, heningSettings) {
  const iqSet = iqomahSettings[key] || {};
  const iqomahMenit = iqSet.aktif && iqSet.menit > 0 ? iqSet.menit : 0;
  const iqomahEnd = new Date(azanTime.getTime() + (adzanMenit + iqomahMenit) * 60000);
  const hSet = heningSettings[key] || {};
  const heningMenit = hSet.aktif && hSet.menit > 0 ? hSet.menit : 0;
  return new Date(iqomahEnd.getTime() + heningMenit * 60000);
}

// Aktif kalau now masuk window sebelum ATAU sesudah salah satu waktu sholat
// (semua waktu sholat, bukan pilihan tertentu), atau mode "selalu" (lewati
// semua window, langsung ikut rotasi utama seperti QR/Jadwal Kegiatan).
export function acaraAktif(now, jadwal, settings) {
  if (settings.mode === "selalu") return true;

  const adzanMenit = loadAdzan().menit;
  const iqomahSettings = loadIqomah();
  const heningSettings = loadHening();

  for (const { key } of SHOLAT) {
    const t = parseHM(jadwal[key], now);
    const { sebelum, sesudah } = settings;
    if (sebelum.aktif) {
      const start = new Date(t.getTime() - sebelum.mulaiMenit * 60000);
      const end = new Date(t.getTime() - sebelum.selesaiMenit * 60000);
      if (now >= start && now < end) return true;
    }
    if (sesudah.aktif) {
      const anchor = kembaliNormalWaktu(t, key, adzanMenit, iqomahSettings, heningSettings);
      const start = new Date(anchor.getTime() + sesudah.mulaiMenit * 60000);
      const end = new Date(anchor.getTime() + sesudah.selesaiMenit * 60000);
      if (now >= start && now < end) return true;
    }
  }
  return false;
}
