import { SHOLAT, DEFAULT_MUROTAL } from "./config.js";
import { parseHM } from "./waktu.js";

const KEY = "murotalSettings";

export function loadMurotal() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    return {
      ...DEFAULT_MUROTAL,
      ...s,
      perSholat: { ...DEFAULT_MUROTAL.perSholat, ...(s.perSholat || {}) },
      posisi: { ...DEFAULT_MUROTAL.posisi, ...(s.posisi || {}) },
      playlist: Array.isArray(s.playlist) ? s.playlist : [],
    };
  } catch {
    return { ...DEFAULT_MUROTAL };
  }
}

export function saveMurotal(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

// Sholat yang jendela murotalnya sedang aktif, atau null.
// Jendela key = [jamSholat - mulaiMenit, jamSholat - berhentiMenit).
export function murotalWindow(now, jadwal, settings) {
  if (!settings.aktif) return null;
  for (const { key } of SHOLAT) {
    if (!settings.perSholat[key]) continue;
    const t = parseHM(jadwal[key], now);
    const start = new Date(t.getTime() - settings.mulaiMenit * 60000);
    const end = new Date(t.getTime() - settings.berhentiMenit * 60000);
    if (now >= start && now < end) return { key };
  }
  return null;
}
