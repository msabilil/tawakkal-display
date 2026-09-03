import { DEFAULT_IQOMAH, SHOLAT } from "./config.js";

const KEY = "iqomahSettings";

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
}
