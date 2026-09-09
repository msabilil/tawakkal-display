import { loadJumatSlides } from "./jumat-mode.js";
import { tampilkan } from "./navigasi.js";

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

const DURASI_TRANSISI_MS = 700;

// Crossfade: elemen baru ditumpuk di atas yang lama, keduanya fade bareng
// (baru masuk, lama keluar), baru yang lama dihapus setelah transisinya selesai.
function tampilkanSlide(slides, i) {
  const s = slides[i % slides.length];
  const url = `img/${s.file}`;
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

  timerId = setTimeout(() => lanjut(slides, i + 1), Math.max(1, s.durasiDetik) * 1000);
}

// Preview: putar terus tanpa cek waktu selesai (biar admin bisa lihat siklusnya).
// Normal: berhenti & balik ke view sholat begitu lewat endTime yang disimpan app.js.
function lanjut(slides, i) {
  if (!previewAktif) {
    const endTime = bacaEndTime();
    if (!endTime || new Date() >= endTime) {
      localStorage.removeItem(KEY);
      tampilkan("sholat");
      return;
    }
  }
  tampilkanSlide(slides, i);
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
  if (!previewAktif && !bacaEndTime()) {
    tampilkan("sholat");
    return;
  }
  tampilkanSlide(slides, 0);
  return () => clearTimeout(timerId);
}
