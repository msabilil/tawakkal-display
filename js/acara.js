import { loadAcaraSlides } from "./acara-mode.js";
import { lanjutRotasi } from "./rotasi.js";
import { tampilkan } from "./navigasi.js";

const elMedia = document.getElementById("acara-media");
const elKosong = document.getElementById("acara-kosong");

const DURASI_TRANSISI_MS = 700;
let timerId = null;

// Crossfade sama pola jumat.js: elemen baru ditumpuk di atas yang lama,
// keduanya fade bareng, baru yang lama dihapus setelah transisinya selesai.
function tampilkanSlide(slides, i, preview) {
  if (i >= slides.length) {
    if (preview) { tampilkanSlide(slides, 0, true); return; } // preview: ulang terus biar admin lihat siklusnya
    lanjutRotasi(new Date()); // sudah semua gambar tampil - lanjut kartu berikutnya (qr/kegiatan)
    return;
  }
  const s = slides[i];
  const lama = elMedia.querySelector(".tampil");

  const baru = document.createElement("img");
  baru.src = s.urlCloud;
  baru.alt = "";
  elMedia.appendChild(baru);

  requestAnimationFrame(() => {
    baru.classList.add("tampil");
    if (lama) lama.classList.remove("tampil");
  });
  if (lama) setTimeout(() => lama.remove(), DURASI_TRANSISI_MS);

  timerId = setTimeout(() => tampilkanSlide(slides, i + 1, preview), Math.max(1, s.durasiDetik) * 1000);
}

// Dipanggil router (navigasi.js) tiap masuk view "acara".
export function start(opsi) {
  elMedia.innerHTML = ""; // buang sisa slide dari putaran sebelumnya
  const slides = loadAcaraSlides();
  elKosong.hidden = !!slides.length;
  if (!slides.length) {
    if (!opsi.preview) tampilkan("sholat");
    return;
  }
  tampilkanSlide(slides, 0, !!opsi.preview);
  return () => clearTimeout(timerId);
}
