import { loadJumatSlides, loadJumatSettings } from "./jumat-mode.js";
import { tampilkan } from "./navigasi.js";
import { mulaiHening } from "./hening.js";
import { loadHening } from "./settings.js";

const KEY = "jumatAktif";
const elMedia = document.getElementById("jumat-media");
const elKosong = document.getElementById("jumat-kosong");

let previewAktif = false;
let timerId = null;

function bacaEndTime() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data && data.endTime ? new Date(data.endTime) : null;
  } catch {
    return null;
  }
}

function bacaState() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function statePreview() {
  const now = Date.now();
  const settings = loadJumatSettings();
  const slideEnd = now + settings.durasiMenit * 60000;
  const heningMenit = Math.max(0, loadHening().dzuhur.menit || 0);
  return {
    slideEndTime: new Date(slideEnd).toISOString(),
    sholatModeAktif: !!settings.sholatModeAktif,
    endTime: new Date(slideEnd + (settings.sholatModeAktif ? heningMenit * 60000 : 0)).toISOString(),
  };
}

const DURASI_TRANSISI_MS = 700;

// Crossfade: elemen baru ditumpuk di atas yang lama, keduanya fade bareng
// (baru masuk, lama keluar), baru yang lama dihapus setelah transisinya selesai.
function tampilkanSlide(slides, i, state) {
  if (Date.now() >= new Date(state.slideEndTime).getTime()) {
    selesaiSlide(state);
    return;
  }
  const s = slides[i % slides.length];
  const url = s.urlCloud;
  const lama = elMedia.querySelector(".tampil");

  const baru = document.createElement(s.tipe === "video" ? "video" : "img");
  baru.src = url;
  if (s.tipe === "video") {
    baru.autoplay = true;
    baru.muted = true;
    baru.loop = true;
    baru.playsInline = true;
  } else {
    baru.alt = "";
  }
  elMedia.appendChild(baru);

  requestAnimationFrame(() => {
    baru.classList.add("tampil");
    if (lama) lama.classList.remove("tampil");
  });
  if (lama) setTimeout(() => lama.remove(), DURASI_TRANSISI_MS);

  const sampaiSlideSelesai = new Date(state.slideEndTime).getTime() - Date.now();
  const jeda = Math.min(Math.max(1, s.durasiDetik) * 1000, sampaiSlideSelesai);
  timerId = setTimeout(() => lanjut(slides, i + 1, state), Math.max(0, jeda));
}

function lanjut(slides, i, state) {
  if (new Date() >= new Date(state.endTime)) {
    localStorage.removeItem(KEY);
    tampilkan("sholat");
    return;
  }
  tampilkanSlide(slides, i, state);
}

function selesaiSlide(state) {
  if (new Date() >= new Date(state.endTime)) {
    localStorage.removeItem(KEY);
    tampilkan("sholat");
    return;
  }
  if (state.sholatModeAktif) {
    mulaiHening(state.endTime, { putarNada: false });
    return;
  }
  localStorage.removeItem(KEY);
  tampilkan("sholat");
}

// Dipanggil router (navigasi.js) tiap masuk view "jumat".
export function start(opsi) {
  previewAktif = !!opsi.preview;
  elMedia.innerHTML = ""; // buang sisa slide dari sesi jum'at sebelumnya
  elKosong.hidden = true;
  const slides = loadJumatSlides();
  if (!slides.length) {
    elKosong.hidden = false;
    return;
  }
  const state = previewAktif ? statePreview() : bacaState();
  if (!state || (!previewAktif && !bacaEndTime())) {
    tampilkan("sholat");
    return;
  }
  tampilkanSlide(slides, 0, state);
  return () => clearTimeout(timerId);
}
