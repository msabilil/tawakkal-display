import { DEFAULT_IQOMAH, DEFAULT_ADZAN, DEFAULT_HENING, DEFAULT_NADA, DEFAULT_KOREKSI_WAKTU, SHOLAT, PENGUMUMAN } from "./config.js";
import { cloudSet } from "./cloud.js";
import { simpanPengaturan } from "./penyimpanan-pengaturan.js";
import { normalizeKoreksiMenit } from "./waktu.js";

const KEY = "iqomahSettings";
const KEY_ADZAN = "adzanSettings";
const KEY_HENING = "heningSettings";
const KEY_NADA = "nadaSettings";
const KEY_PENGUMUMAN = "pengumumanSettings";
const KEY_KOREKSI_WAKTU = "koreksiWaktuSettings";

function bacaObject(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function normalisasiKoreksi(stored) {
  const result = {};
  for (const { key } of SHOLAT) {
    result[key] = normalizeKoreksiMenit(stored[key]);
  }
  return result;
}

export function loadKoreksiWaktu() {
  return normalisasiKoreksi(bacaObject(KEY_KOREKSI_WAKTU));
}

export async function saveKoreksiWaktu(settings, sinkronkan = cloudSet) {
  const normalized = normalisasiKoreksi(settings || {});
  const hasil = await simpanPengaturan(KEY_KOREKSI_WAKTU, normalized, { sinkronkan });
  return { settings: normalized, ...hasil };
}

export async function resetKoreksiWaktu(sinkronkan = cloudSet) {
  return saveKoreksiWaktu(DEFAULT_KOREKSI_WAKTU, sinkronkan);
}

export function loadIqomah() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    stored = {};
  }
  const result = {};
  for (const { key } of SHOLAT) {
    const def = DEFAULT_IQOMAH[key];
    const cur = stored[key] || {};
    result[key] = {
      menit: Number.isFinite(cur.menit) ? cur.menit : def.menit,
      aktif: typeof cur.aktif === "boolean" ? cur.aktif : def.aktif,
    };
  }
  return result;
}

export function saveIqomah(settings, opsi) {
  return simpanPengaturan(KEY, settings, opsi);
}

export function loadHening() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY_HENING)) || {};
  } catch {
    stored = {};
  }
  const result = {};
  for (const { key } of SHOLAT) {
    const def = DEFAULT_HENING[key];
    const cur = stored[key] || {};
    result[key] = {
      menit: Number.isFinite(cur.menit) ? cur.menit : def.menit,
      aktif: typeof cur.aktif === "boolean" ? cur.aktif : def.aktif,
    };
  }
  return result;
}

export function saveHening(settings, opsi) {
  return simpanPengaturan(KEY_HENING, settings, opsi);
}

export function loadNada() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_NADA));
    return { ...DEFAULT_NADA, ...(s || {}) };
  } catch {
    return { ...DEFAULT_NADA };
  }
}

export function saveNada(settings, opsi) {
  return simpanPengaturan(KEY_NADA, settings, opsi);
}

export function loadAdzan() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_ADZAN));
    return { ...DEFAULT_ADZAN, ...(s || {}) };
  } catch {
    return { ...DEFAULT_ADZAN };
  }
}

export function saveAdzan(settings, opsi) {
  return simpanPengaturan(KEY_ADZAN, settings, opsi);
}

export function loadPengumuman() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY_PENGUMUMAN));
    return Array.isArray(arr) ? arr : PENGUMUMAN;
  } catch {
    return PENGUMUMAN;
  }
}

export function savePengumuman(arr, opsi) {
  return simpanPengaturan(KEY_PENGUMUMAN, arr, opsi);
}
