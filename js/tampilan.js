import { cloudSet } from "./cloud.js";

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

export function saveTampilan(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  cloudSet(KEY, settings);
}
