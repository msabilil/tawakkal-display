import { loadJumatSlides, loadJumatSettings } from "./jumat-mode.js";
import { tampilkan } from "./navigasi.js";
import { loadHening } from "./settings.js";
import { buatPratinjauJumat } from "./alur-ibadah.js";
import { formatJamWIB } from "./waktu.js";

const KEY = "jumatAktif";
const elMedia = document.getElementById("jumat-media");
const elKosong = document.getElementById("jumat-kosong");
const elJam = document.getElementById("jumat-jam");

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
  const settings = loadJumatSettings();
  const heningMenit = Math.max(0, loadHening().dzuhur.menit || 0);
  return buatPratinjauJumat({
    sekarang: new Date(),
    durasiMenit: settings.durasiMenit,
    heningMenit,
    sholatModeAktif: settings.sholatModeAktif,
  }).state;
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
    return;
  }
  tampilkanSlide(slides, i, state);
}

function selesaiSlide(state) {
  if (new Date() >= new Date(state.endTime)) {
    return;
  }
}

// Dipanggil router (navigasi.js) tiap masuk view "jumat".
export function start(opsi) {
  previewAktif = !!opsi.preview;
  elMedia.innerHTML = ""; // buang sisa slide dari sesi jum'at sebelumnya
  elKosong.hidden = true;
  const state = previewAktif ? statePreview() : bacaState();
  if (!state || (!previewAktif && !bacaEndTime())) {
    tampilkan("sholat");
    return;
  }
  // Pada demo, pemantau jadwal app.js tidak berjalan; pratinjau memiliki
  // tenggat sendiri, sedangkan akhir demo tetap diatur oleh halaman induk.
  const previewTimer = previewAktif && state.sholatModeAktif
    && new Date(state.endTime) > new Date(state.slideEndTime)
    ? setTimeout(() => tampilkan("hening", { preview: true, startTime: state.slideEndTime }),
      Math.max(0, new Date(state.slideEndTime).getTime() - Date.now()))
    : null;
  const stop = () => {
    clearTimeout(timerId);
    clearInterval(timerId);
    clearTimeout(previewTimer);
  };
  const slides = loadJumatSlides();
  if (!slides.length) {
    elKosong.hidden = false;
    const perbaruiJam = () => { elJam.textContent = `${formatJamWIB(new Date()).slice(0, 5)} WIB`; };
    perbaruiJam();
    timerId = setInterval(perbaruiJam, 1000);
    return stop;
  }
  tampilkanSlide(slides, 0, state);
  return stop;
}
