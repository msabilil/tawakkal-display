import { getMedia, cloudUrlUntukMedia } from "./media-db.js";

// Beep pendek berulang sebagai nada default (tanpa file aset).
export function beep(durasiDetik = 1) {
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  const mulai = ctx.currentTime;
  const sampai = mulai + Math.max(1, durasiDetik);
  for (let t = mulai; t < sampai; t += 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(Math.min(t + 0.3, sampai));
  }
  setTimeout(() => ctx.close().catch(() => {}), Math.max(1, durasiDetik) * 1000 + 500);
}

function hentikanAudio(audioEl) {
  if (!audioEl) return;
  clearTimeout(audioEl._timerNada);
  audioEl.pause();
  audioEl.loop = false;
  try { audioEl.currentTime = 0; } catch {}
}

export async function mainkanNada(audioEl, { mediaKey = "nadaIqomah", durasiDetik = 8 } = {}) {
  const durasi = Math.max(1, Number(durasiDetik) || 1);
  hentikanAudio(audioEl);
  // Lokal dulu (kerja offline) - baru fallback ke URL cloud kalau blob-nya
  // tidak ada di IndexedDB device ini (mis. diupload dari laptop admin yang
  // beda device). Kalau dua-duanya tidak ada, fallback beep sintetis.
  const blob = await getMedia(mediaKey);
  const src = blob ? URL.createObjectURL(blob) : cloudUrlUntukMedia(mediaKey);
  if (src && audioEl) {
    audioEl.src = src;
    audioEl.loop = true;
    try {
      await audioEl.play();
      audioEl._timerNada = setTimeout(() => {
        hentikanAudio(audioEl);
        if (blob) URL.revokeObjectURL(src);
      }, durasi * 1000);
      return;
    } catch {
      if (blob) URL.revokeObjectURL(src);
      // gagal (autoplay diblok / URL cloud tidak bisa dimuat) -> fallback beep
    }
  }
  beep(durasi);
}
