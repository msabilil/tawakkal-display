import { loadKoreksiWaktu } from "./settings.js";
import { applyKoreksiWaktu } from "./waktu.js";

// Jalur yang membaca cache secara langsung (preview/rotasi) tetap harus
// memakai jadwal yang sama dengan loop utama aplikasi.
export function jadwalTerkoreksi(jadwal) {
  return applyKoreksiWaktu(jadwal, loadKoreksiWaktu());
}
