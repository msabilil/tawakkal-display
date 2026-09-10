import { DEFAULT_IQOMAH, DEFAULT_ADZAN, DEFAULT_HENING, SHOLAT, PENGUMUMAN } from "./config.js";
import { cloudSet } from "./cloud.js";

const KEY = "iqomahSettings";
const KEY_ADZAN = "adzanSettings";
const KEY_HENING = "heningSettings";
const KEY_PENGUMUMAN = "pengumumanSettings";

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

export function saveIqomah(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  cloudSet(KEY, settings);
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

export function saveHening(settings) {
  localStorage.setItem(KEY_HENING, JSON.stringify(settings));
  cloudSet(KEY_HENING, settings);
}

export function loadAdzan() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_ADZAN));
    return { ...DEFAULT_ADZAN, ...(s || {}) };
  } catch {
    return { ...DEFAULT_ADZAN };
  }
}

export function saveAdzan(settings) {
  localStorage.setItem(KEY_ADZAN, JSON.stringify(settings));
  cloudSet(KEY_ADZAN, settings);
}

export function loadPengumuman() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY_PENGUMUMAN));
    return Array.isArray(arr) && arr.length ? arr : PENGUMUMAN;
  } catch {
    return PENGUMUMAN;
  }
}

export function savePengumuman(arr) {
  localStorage.setItem(KEY_PENGUMUMAN, JSON.stringify(arr));
  cloudSet(KEY_PENGUMUMAN, arr);
}
