// Demo Layar - jalan sendiri (slideshow) atau manual (tombol panah), ukuran
// asli penuh (iframe 100vw x 100vh), lewat semua halaman lewat mode preview
// biar tidak bergantung waktu sholat asli. Tapi slide yang sifatnya fitur
// opsional (QR/kegiatan/jum'at) cuma dimasukkan kalau memang aktif
// di setting admin - lihat slideAktif() - biar demo sama persis kayak
// index.html asli, bukan menampilkan fitur yang sebenarnya nonaktif/kosong.
//
// Layar penuh WAJIB punya dokumen demo.html sendiri (bukan tombol layar
// penuh bawaan tiap halaman di dalam iframe) - kalau fullscreen dipicu di
// dalam iframe, dia ikut hilang begitu iframe pindah src (ganti slide) dan
// #demo-bar (di dokumen luar) ikut tidak kelihatan karena di luar elemen
// yang di-fullscreen-kan. Makanya iframe dikunci allow="fullscreen 'none'"
// di HTML - tombol layar penuh di dalam iframe sengaja dimatikan.
import { setupFullscreen } from "./fullscreen.js";
import { slideAktif } from "./demo-slide.js";
setupFullscreen();

const URUTAN = slideAktif();
const DURASI_MS = 10000;

const $ = (id) => document.getElementById(id);
const frame = $("demo-frame");
const namaEl = $("demo-nama");
const hitungEl = $("demo-hitung");
const btnPlay = $("demo-play");

let idx = 0;
let main = true;
let timer = null;

function render() {
  const s = URUTAN[idx];
  frame.src = s.src;
  namaEl.textContent = s.label;
  hitungEl.textContent = `${idx + 1} / ${URUTAN.length}`;
}

function jadwalkanBerikutnya() {
  clearTimeout(timer);
  if (main) timer = setTimeout(() => geser(1), DURASI_MS);
}

function geser(arah) {
  idx = (idx + arah + URUTAN.length) % URUTAN.length;
  render();
  jadwalkanBerikutnya();
}

function togglePlay() {
  main = !main;
  btnPlay.innerHTML = main ? "&#10074;&#10074;" : "&#9654;";
  btnPlay.setAttribute("aria-label", main ? "Jeda" : "Main");
  jadwalkanBerikutnya();
}

$("demo-prev").addEventListener("click", () => geser(-1));
$("demo-next").addEventListener("click", () => geser(1));
btnPlay.addEventListener("click", togglePlay);

render();
jadwalkanBerikutnya(); // mulai jalan sendiri (main = true)
