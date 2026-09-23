// Data & state mode Jum'at (layar khusus pas jam Dzuhur hari Jumat, gantiin
// skip-diam-diam yang lama). File slide (gambar/video) diupload ke Supabase
// Storage dari admin.js, di sini cuma urus metadata (localStorage/cloud) &
// logika kapan mode ini aktif.
import { DEFAULT_JUMAT } from "./config.js";
import { simpanPengaturan } from "./penyimpanan-pengaturan.js";
import { loadAdzan, loadHening } from "./settings.js";
import { tentukanAlur } from "./alur-ibadah.js";

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

export function saveJumatSettings(settings, opsi) {
  return simpanPengaturan(KEY_SETTINGS, settings, opsi);
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
  return simpanPengaturan(KEY_SLIDES, slides);
}

// Alur Jumat: Adzan Dzuhur -> slide khutbah -> (opsional) Sholat Mode.
// Durasi slide dihitung setelah Adzan selesai; kalau Sholat Mode aktif,
// durasi layar hitam mengikuti durasi Dzuhur di pengaturan Sholat Mode.
export function jumatState(now, jadwal) {
  const settings = loadJumatSettings();
  const keputusan = tentukanAlur({
    now,
    jadwal,
    iqomah: {},
    hening: loadHening(),
    adzanMenit: loadAdzan().menit,
    jumat: { ...settings, adaSlide: loadJumatSlides().length > 0 },
    tarawih: null,
  });
  if (!keputusan) return null;
  if (keputusan.view === "iqomah" && keputusan.state.key === "jumat") {
    return { fase: "adzan", ...keputusan.state };
  }
  if (keputusan.view === "jumat") return { fase: "slide", ...keputusan.state };
  if (keputusan.view === "hening" && keputusan.state.putarNada === false) {
    return { fase: "hening", ...keputusan.state };
  }
  return null;
}
