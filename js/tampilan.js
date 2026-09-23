import { simpanPengaturan } from "./penyimpanan-pengaturan.js";

const KEY = "tampilanSettings";

function kosong() {
  return { header: true, maklumat: true };
}

export function loadTampilan() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (!stored) return kosong();
    return { ...kosong(), ...stored };
  } catch {
    return kosong();
  }
}

export function saveTampilan(settings, opsi) {
  return simpanPengaturan(KEY, settings, opsi);
}
