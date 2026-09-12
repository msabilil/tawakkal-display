// Data & state mode Jum'at (layar khusus pas jam Dzuhur hari Jumat, gantiin
// skip-diam-diam yang lama). File slide (gambar/video) diupload ke Supabase
// Storage dari admin.js, di sini cuma urus metadata (localStorage/cloud) &
// logika kapan mode ini aktif.
import { DEFAULT_JUMAT } from "./config.js";
import { parseHM } from "./waktu.js";
import { cloudSet } from "./cloud.js";
import { loadAdzan, loadHening } from "./settings.js";

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

// Alur Jumat: Adzan Dzuhur -> slide khutbah -> (opsional) Sholat Mode.
// Durasi slide dihitung setelah Adzan selesai; kalau Sholat Mode aktif,
// durasi layar hitam mengikuti durasi Dzuhur di pengaturan Sholat Mode.
export function jumatState(now, jadwal) {
  if (now.getDay() !== 5) return null;
  if (!loadJumatSlides().length) return null;
  const settings = loadJumatSettings();
  const mulai = parseHM(jadwal.dzuhur, now);
  const adzanEnd = new Date(mulai.getTime() + loadAdzan().menit * 60000);
  const slideEnd = new Date(adzanEnd.getTime() + settings.durasiMenit * 60000);
  const heningMenit = Math.max(0, loadHening().dzuhur.menit || 0);
  const selesai = new Date(slideEnd.getTime() + (settings.sholatModeAktif ? heningMenit * 60000 : 0));
  if (now >= mulai && now < selesai) {
    const fase = now < adzanEnd ? "adzan" : now < slideEnd ? "slide" : "hening";
    return {
      fase,
      adzanEndTime: adzanEnd.toISOString(),
      slideEndTime: slideEnd.toISOString(),
      sholatModeAktif: !!settings.sholatModeAktif,
      endTime: selesai.toISOString(),
    };
  }
  return null;
}
