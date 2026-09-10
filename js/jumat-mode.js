// Data & state mode Jum'at (layar khusus pas jam Dzuhur hari Jumat, gantiin
// skip-diam-diam yang lama). File slide (gambar/video) diupload ke Supabase
// Storage dari admin.js, di sini cuma urus metadata (localStorage/cloud) &
// logika kapan mode ini aktif.
import { DEFAULT_JUMAT } from "./config.js";
import { parseHM } from "./waktu.js";
import { cloudSet } from "./cloud.js";

const KEY_SETTINGS = "jumatSettings";
const KEY_SLIDES = "jumatSlides"; // [{id, tipe:"gambar"|"video", file:"jumat-<id>.<ext>", durasiDetik}]

export function loadJumatSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_SETTINGS));
    return { ...DEFAULT_JUMAT, ...(s || {}) };
  } catch {
    return { ...DEFAULT_JUMAT };
  }
}

export function saveJumatSettings(settings) {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  cloudSet(KEY_SETTINGS, settings);
}

export function loadJumatSlides() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY_SLIDES));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveJumatSlides(slides) {
  localStorage.setItem(KEY_SLIDES, JSON.stringify(slides));
  cloudSet(KEY_SLIDES, slides);
}

// Aktif kalau: hari Jumat, sekarang di window [azan Dzuhur, azan Dzuhur +
// durasi], dan ada minimal 1 slide (kalau kosong, biarkan perilaku lama:
// dzuhur dilewati diam-diam, jangan nampilin layar kosong).
export function jumatState(now, jadwal) {
  if (now.getDay() !== 5) return null;
  if (!loadJumatSlides().length) return null;
  const mulai = parseHM(jadwal.dzuhur, now);
  const selesai = new Date(mulai.getTime() + loadJumatSettings().durasiMenit * 60000);
  if (now >= mulai && now < selesai) return { endTime: selesai.toISOString() };
  return null;
}
