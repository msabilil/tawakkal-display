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

import { getMedia } from "./media-db.js";

let audioEl = null, indikatorEl = null, labelEl = null, overlayEl = null;
let sedangMain = false;
let objectUrl = null;         // URL blob offline yang perlu di-revoke
let gagalBeruntun = 0;        // guard anti-loop kalau semua track gagal
let simpanTerakhir = 0;       // throttle simpan posisi

export function initMurotal(refs) {
  audioEl = refs.audioEl;
  indikatorEl = refs.indikatorEl;
  labelEl = refs.labelEl;
  overlayEl = refs.overlayEl;

  audioEl.addEventListener("ended", () => {
    gagalBeruntun = 0;
    majuTrack(+1, 0);
  });
  audioEl.addEventListener("error", () => {
    if (!sedangMain) return;
    gagalBeruntun++;
    const s = loadMurotal();
    if (gagalBeruntun >= s.playlist.length) { hentikan(false); return; } // semua gagal
    majuTrack(+1, 0);
  });
  audioEl.addEventListener("timeupdate", () => {
    if (!sedangMain) return;
    const kini = Date.now();
    if (kini - simpanTerakhir > 5000) { simpanTerakhir = kini; simpanPosisi(); }
  });

  if (overlayEl) {
    overlayEl.addEventListener("click", () => {
      audioEl.play().catch(() => {});
      overlayEl.hidden = true;
    });
  }
}

function simpanPosisi() {
  const s = loadMurotal();
  s.posisi = { index: s.posisi.index, detik: audioEl.currentTime || 0 };
  saveMurotal(s);
}

async function muatTrack(item) {
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  if (item.tipe === "offline") {
    const blob = await getMedia(item.mediaKey);
    if (!blob) return false;
    objectUrl = URL.createObjectURL(blob);
    audioEl.src = objectUrl;
  } else {
    audioEl.src = item.url;
  }
  return true;
}

async function mainkanIndex(index, detik) {
  const s = loadMurotal();
  if (!s.playlist.length) return;
  const idx = ((index % s.playlist.length) + s.playlist.length) % s.playlist.length;
  const item = s.playlist[idx];
  s.posisi = { index: idx, detik: detik || 0 };
  saveMurotal(s);
  const ok = await muatTrack(item);
  if (!ok) {
    gagalBeruntun++;
    if (gagalBeruntun < s.playlist.length) majuTrack(+1, 0); else hentikan(false);
    return;
  }
  audioEl.currentTime = detik || 0;
  try {
    await audioEl.play();
    if (overlayEl) overlayEl.hidden = true;
  } catch {
    // Autoplay diblok (bukan kiosk): tampilkan overlay unlock.
    if (overlayEl) overlayEl.hidden = false;
  }
  tampilIndikator(item.label);
}

function majuTrack(arah, detik) {
  const s = loadMurotal();
  if (!s.playlist.length) return;
  mainkanIndex(s.posisi.index + arah, detik);
}

function tampilIndikator(label) {
  if (!indikatorEl) return;
  if (labelEl) labelEl.textContent = label || "";
  indikatorEl.hidden = false;
}

function hentikan(simpan) {
  if (simpan && audioEl && !audioEl.paused) simpanPosisi();
  if (audioEl) { audioEl.pause(); }
  if (indikatorEl) indikatorEl.hidden = true;
  sedangMain = false;
  gagalBeruntun = 0;
}

export function tickMurotal(now, jadwal) {
  if (!audioEl) return;
  const s = loadMurotal();
  const win = murotalWindow(now, jadwal, s);
  if (win && !sedangMain) {
    sedangMain = true;
    gagalBeruntun = 0;
    mainkanIndex(s.posisi.index, s.posisi.detik);
  } else if (!win && sedangMain) {
    hentikan(true);
  }
}

export function stopMurotal() {
  hentikan(true);
}
