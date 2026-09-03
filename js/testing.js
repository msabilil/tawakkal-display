import { WAKTU_HARIAN } from "./config.js";

const KEY = "jadwalOverride";

function kosong() {
  const jadwal = {};
  for (const { key } of WAKTU_HARIAN) jadwal[key] = "";
  return { aktif: false, jadwal };
}

export function loadOverride() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (!stored) return kosong();
    const base = kosong();
    return {
      aktif: !!stored.aktif,
      jadwal: { ...base.jadwal, ...(stored.jadwal || {}) },
    };
  } catch {
    return kosong();
  }
}

export function saveOverride(override) {
  localStorage.setItem(KEY, JSON.stringify(override));
}

export function clearOverride() {
  localStorage.removeItem(KEY);
}

// Terapkan override (kalau aktif) ke jadwal asli. Hanya field yang diisi
// di override yang menimpa; field kosong tetap pakai jadwal asli.
export function terapkanOverride(jadwalAsli) {
  const ov = loadOverride();
  if (!ov.aktif) return jadwalAsli;
  const hasil = { ...jadwalAsli };
  for (const [key, val] of Object.entries(ov.jadwal)) {
    if (val) hasil[key] = val;
  }
  return hasil;
}
