import { getMedia } from "./media-db.js";

// Tiga beep pendek sebagai nada default (tanpa file aset).
export function beep() {
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  const mulai = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    const t = mulai + i * 0.35;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

export async function mainkanNada(audioEl) {
  const blob = await getMedia("nadaIqomah");
  if (blob && audioEl) {
    const url = URL.createObjectURL(blob);
    audioEl.src = url;
    audioEl.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    try {
      await audioEl.play();
      return;
    } catch {
      // gagal (autoplay diblok) -> fallback beep
    }
  }
  beep();
}
