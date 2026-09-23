import { loadKoreksiWaktu } from "./settings.js";
import { applyKoreksiWaktu } from "./waktu.js";
import { SHOLAT } from "./config.js";

// Jalur yang membaca cache secara langsung (preview/rotasi) tetap harus
// memakai jadwal yang sama dengan loop utama aplikasi.
export function jadwalTerkoreksi(jadwal) {
  return applyKoreksiWaktu(jadwal, loadKoreksiWaktu());
}

export function ringkasJadwalSholat(jadwal) {
  if (!jadwal) return [];
  return SHOLAT
    .filter(({ key }) => typeof jadwal[key] === "string")
    .map(({ key, label }) => ({ key, label, jam: jadwal[key] }));
}
